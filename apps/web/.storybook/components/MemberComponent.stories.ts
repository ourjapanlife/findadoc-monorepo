import type { Meta, StoryObj } from '@storybook/vue3'
import MemberComponent from '../../components/about/MemberComponent.vue'

const meta = {
    title: 'components/about/MemberComponent',
    component: MemberComponent,
    tags: ['autodocs']
} satisfies Meta<typeof MemberComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        avatarImg: '/public/avatars/andrew_leemhuis.jpg',
        name: 'Andrew Leemhuis',
        title: 'Full stack developer',
        dataTestId: 1,
        githubUrl: '',
        linkedInUrl: ''
    }
}
