/// <reference types="vitest/globals" />
import { mount } from '@vue/test-utils'
import { expect } from 'chai'
import ModSearchBar from '~/components/moderation-panel/ModSearchBar.vue'
import { searchResultMenuBox } from '~/utils/searchResultMenu'

const viewport = { width: 1200, height: 800 }

describe('searchResultMenuBox', () => {
    it('opens below a field that has room, at the field width', () => {
        const box = searchResultMenuBox(
            { top: 100, bottom: 148, left: 40, width: 320 },
            viewport.width,
            viewport.height
        )

        expect(box.top).to.equal(152)
        expect(box.bottom).to.equal(null)
        expect(box.left).to.equal(40)
        expect(box.width).to.equal(320)
        expect(box.maxHeight).to.equal(256)
    })

    it('opens above a field in the lower third when that side has more room', () => {
        const box = searchResultMenuBox(
            { top: 700, bottom: 748, left: 40, width: 320 },
            viewport.width,
            viewport.height
        )

        expect(box.top).to.equal(null)
        expect(box.bottom).to.equal(104)
        expect(box.maxHeight).to.be.greaterThan(0)
        expect(box.maxHeight).to.be.at.most(256)
    })

    it('keeps a wide field inside the viewport', () => {
        const box = searchResultMenuBox(
            { top: 100, bottom: 148, left: 1100, width: 400 },
            viewport.width,
            viewport.height
        )

        expect(box.left + box.width).to.be.at.most(viewport.width - 8)
        expect(box.width).to.be.at.most(viewport.width - 16)
    })
})

describe('ModSearchBar results', () => {
    it('renders the open menu on the document, outside an overflow-hidden parent', async () => {
        const parent = document.createElement('div')
        parent.style.overflow = 'hidden'
        document.body.appendChild(parent)
        const wrapper = mount(ModSearchBar, {
            props: {
                modelValue: [],
                placeHolderText: 'Clinics',
                noMatchText: 'None',
                fieldsToDisplayCallback: (item: { name: string }) => [item.name],
                defaultSuggestions: [{ id: 'clinic-1', name: 'Minato Dental' }]
            },
            attachTo: parent
        })

        await wrapper.find('input').trigger('focus')

        const menu = document.body.querySelector('ul.fixed')
        expect(menu, 'menu').to.not.equal(null)
        expect(parent.contains(menu)).to.equal(false)
        wrapper.unmount()
        parent.remove()
    })
})
