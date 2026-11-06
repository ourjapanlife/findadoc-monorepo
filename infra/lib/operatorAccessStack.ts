import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import {
    AmazonLinuxCpuType,
    BlockDeviceVolume,
    CfnInstanceConnectEndpoint,
    EbsDeviceVolumeType,
    Instance,
    InstanceClass,
    InstanceInitiatedShutdownBehavior,
    InstanceSize,
    InstanceType,
    MachineImage,
    Port,
    SecurityGroup,
    SubnetType,
    UserData,
    type ISecurityGroup,
    type IVpc,
} from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'

export interface OperatorAccessStackProps extends StackProps {
    vpc: IVpc
    databaseClients: ISecurityGroup
    databaseHostname: string
}

// Minutes with no SSH connection before the jump host powers itself off.
const IDLE_STOP_MINUTES = 20

// How a person reaches the private database from a laptop (`pnpm db:prod`).
//
// An EC2 Instance Connect Endpoint (free) opens SSH to a t4g.nano jump host that has no public
// address, and SSH forwards a local port to RDS on 5432. The endpoint cannot forward to RDS
// directly: it only accepts remote ports 22 and 3389. The sign-in is the person's Identity Center
// session and a 60-second key that `pnpm db:prod` pushes. There is no stored SSH key and no password.
//
// Cost: the host is stopped unless someone is connected. It powers itself off after
// IDLE_STOP_MINUTES without an SSH connection, so it costs the 8 GB volume (about $0.77 a month)
// plus about $0.005 an hour while it runs. No NAT gateway, public IPv4, or interface endpoint.
export class OperatorAccessStack extends Stack {
    constructor(scope: Construct, id: string, props: OperatorAccessStackProps) {
        super(scope, id, props)

        const endpointSecurityGroup = new SecurityGroup(this, 'InstanceConnectEndpoint', {
            vpc: props.vpc,
            description: 'EC2 Instance Connect Endpoint for the database jump host',
            allowAllOutbound: false,
        })

        const jumpHostSecurityGroup = new SecurityGroup(this, 'JumpHost', {
            vpc: props.vpc,
            description: 'Database jump host, reachable only through the Instance Connect Endpoint',
            allowAllOutbound: false,
        })

        endpointSecurityGroup.addEgressRule(jumpHostSecurityGroup, Port.tcp(22), 'SSH to the jump host')
        jumpHostSecurityGroup.addIngressRule(endpointSecurityGroup, Port.tcp(22), 'Instance Connect Endpoint')

        const jumpHost = new Instance(this, 'JumpHostInstance', {
            instanceName: 'findadoc-db-jump',
            vpc: props.vpc,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS, availabilityZones: ['ap-northeast-1a'] },
            instanceType: InstanceType.of(InstanceClass.BURSTABLE4_GRAVITON, InstanceSize.NANO),
            // Cached in cdk.context.json, so a new AMI does not replace the host on every deploy.
            machineImage: MachineImage.latestAmazonLinux2023({
                cpuType: AmazonLinuxCpuType.ARM_64,
                cachedInContext: true,
            }),
            securityGroup: jumpHostSecurityGroup,
            requireImdsv2: true,
            associatePublicIpAddress: false,
            instanceInitiatedShutdownBehavior: InstanceInitiatedShutdownBehavior.STOP,
            blockDevices: [{
                deviceName: '/dev/xvda',
                volume: BlockDeviceVolume.ebs(8, { encrypted: true, volumeType: EbsDeviceVolumeType.GP3 }),
            }],
            userData: jumpHostUserData(props.databaseHostname),
            ssmSessionPermissions: false,
        })

        // Joins the group the database accepts on 5432, like the API Lambda.
        jumpHost.addSecurityGroup(props.databaseClients)

        const endpoint = new CfnInstanceConnectEndpoint(this, 'Endpoint', {
            subnetId: props.vpc.selectSubnets({
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                availabilityZones: ['ap-northeast-1a'],
            }).subnetIds[0] ?? '',
            securityGroupIds: [endpointSecurityGroup.securityGroupId],
            // The jump host's security group names the endpoint's group, not a laptop's address.
            preserveClientIp: false,
            tags: [{ key: 'Name', value: 'findadoc-db-jump' }],
        })

        // `pnpm db:prod` reads these outputs by key.
        new CfnOutput(this, 'JumpHostInstanceId', { value: jumpHost.instanceId })
        new CfnOutput(this, 'InstanceConnectEndpointId', { value: endpoint.attrId })
    }
}

// First boot only: allow SSH forwarding to the database and nothing else, and power off when idle.
// /run is cleared on every boot, so a fresh start always gets the full idle allowance.
function jumpHostUserData(databaseHostname: string): UserData {
    const userData = UserData.forLinux()
    userData.addCommands(
        'cat > /etc/ssh/sshd_config.d/90-findadoc.conf <<EOF',
        `PermitOpen ${databaseHostname}:5432`,
        'AllowAgentForwarding no',
        'X11Forwarding no',
        'PermitTunnel no',
        'EOF',
        'systemctl reload sshd',
        '',
        'cat > /usr/local/sbin/findadoc-idle-stop <<\'EOF\'',
        '#!/bin/bash',
        'state=/run/findadoc-idle-minutes',
        'if ss -Htn state established \'( sport = :22 )\' | grep -q .; then',
        '    echo 0 > "$state"',
        '    exit 0',
        'fi',
        'idle=$(( $(cat "$state" 2>/dev/null || echo 0) + 5 ))',
        'echo "$idle" > "$state"',
        `if [ "$idle" -ge ${IDLE_STOP_MINUTES} ]; then`,
        '    systemctl poweroff',
        'fi',
        'EOF',
        'chmod 0755 /usr/local/sbin/findadoc-idle-stop',
        '',
        'cat > /etc/systemd/system/findadoc-idle-stop.service <<\'EOF\'',
        '[Unit]',
        'Description=Power off the jump host when no one is connected',
        '[Service]',
        'Type=oneshot',
        'ExecStart=/usr/local/sbin/findadoc-idle-stop',
        'EOF',
        '',
        'cat > /etc/systemd/system/findadoc-idle-stop.timer <<\'EOF\'',
        '[Unit]',
        'Description=Check for an idle jump host every 5 minutes',
        '[Timer]',
        'OnBootSec=5min',
        'OnUnitActiveSec=5min',
        '[Install]',
        'WantedBy=timers.target',
        'EOF',
        '',
        'systemctl daemon-reload',
        'systemctl enable --now findadoc-idle-stop.timer',
    )
    return userData
}
