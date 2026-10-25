import { expect } from 'chai'
import {
    ADMIN_SITE_MODE,
    ADMIN_SITE_PATH,
    adminHostTarget,
    adminSiteAccess,
    adminSiteMode,
    adminSitePreviewCookie,
    isAdminHost,
    isAdminPath
} from '@/utils/adminSite'

describe('admin site flag', () => {
    it('reads the same three modes as a clinic landing', () => {
        expect(ADMIN_SITE_MODE).to.equal('preview')
        expect(adminSiteMode(undefined)).to.equal('off')
        expect(adminSiteMode('preview')).to.equal('preview')
        expect(adminSiteMode('true')).to.equal('preview')
        expect(adminSiteMode('public')).to.equal('public')
    })

    it('recognises only the admin hosts', () => {
        expect(isAdminHost('admin.localhost')).to.equal(true)
        expect(isAdminHost('admin.localhost:3000')).to.equal(true)
        expect(isAdminHost('admin.findadoc.jp')).to.equal(true)
        expect(isAdminHost('www.findadoc.jp')).to.equal(false)
        expect(isAdminHost('admin.example.findadoc.jp')).to.equal(false)
        expect(isAdminHost('multilingual-online-clinic.localhost')).to.equal(false)
    })

    it('redirects the admin host root to /admin and leaves the page itself', () => {
        expect(adminHostTarget('admin.localhost', '/', 'preview')).to.equal(ADMIN_SITE_PATH)
        expect(adminHostTarget('admin.findadoc.jp', '/ja-JP', 'public')).to.equal('/ja-JP/admin')
        expect(adminHostTarget('admin.localhost', '/submit', 'preview')).to.equal(ADMIN_SITE_PATH)
        expect(adminHostTarget('admin.localhost', '/admin', 'preview')).to.equal(undefined)
        expect(adminHostTarget('admin.localhost', '/favicon.ico', 'preview')).to.equal(undefined)
        expect(adminHostTarget('admin.localhost', '/', 'off')).to.equal(undefined)
        expect(adminHostTarget('www.findadoc.jp', '/', 'public')).to.equal(undefined)
    })

    it('treats the admin page as the gated path', () => {
        expect(isAdminPath('/admin')).to.equal(true)
        expect(isAdminPath('/ja-JP/admin')).to.equal(true)
        expect(isAdminPath('/admin/users')).to.equal(false)
        expect(isAdminPath('/about')).to.equal(false)
    })

    it('requires the preview cookie unless the flag is public', () => {
        expect(adminSiteAccess('off', '1', '1')).to.equal('deny')
        expect(adminSiteAccess('preview', null, null)).to.equal('deny')
        expect(adminSiteAccess('preview', '1', null)).to.equal('grant')
        expect(adminSiteAccess('preview', null, '1')).to.equal('allow')
        expect(adminSiteAccess('preview', '0', '1')).to.equal('revoke')
        expect(adminSiteAccess('public', null, null)).to.equal('allow')
        expect(adminSitePreviewCookie('admin_site_preview=1; Path=/')).to.equal('1')
    })
})
