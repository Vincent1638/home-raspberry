import * as Component from "./Component";
import { Device } from '../types'

export default class {
    ws: WebSocket;
    devices: Device[];
    dataSet: any
    templates: HTMLElement[]
    options: HTMLElement[]
    container: HTMLElement
    removedDevices: string[]
    activeSelect: HTMLElement

    constructor(ws: WebSocket, devices: Device[], dataSet: any, images: any) {
        this.ws = ws
        this.devices = devices
        this.dataSet = dataSet

        const saveButton = Component.create('button', { class: 'button solid save', id: 'saveDevices' }, 'Save')
        saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="height: 16px; margin-right: 8px;" fill="#FFFFFF"><path d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM272 80v80H144V80h128zm122 352H54a6 6 0 0 1-6-6V86a6 6 0 0 1 6-6h42v104c0 13.255 10.745 24 24 24h176c13.255 0 24-10.745 24-24V83.882l78.243 78.243a6 6 0 0 1 1.757 4.243V426a6 6 0 0 1-6 6zM224 232c-48.523 0-88 39.477-88 88s39.477 88 88 88 88-39.477 88-88-39.477-88-88-88zm0 128c-22.056 0-40-17.944-40-40s17.944-40 40-40 40 17.944 40 40-17.944 40-40 40z"></path></svg>Save'

        const footer = document.createElement('div')
        footer.append(Component.create('button', { class: 'button solid', id: 'addDevice' }, 'Add Device'),
            Component.create('button', { class: 'button solid', id: 'findDevices' }, 'Find Devices'),
            saveButton)

        const panel = Component.create('div', { class: 'panel' })
        panel.append(Component.create('div', { class: 'row' }),
            Component.create('button', { class: 'button', id: 'removeDevice', style: 'margin-top: 15px;' }, 'Remove Device')
        )

        this.templates = [
            Component.select('Type', 'Select Type', ['type'], 0),
            Component.select('Image', 'Select Image', ['image'], 1),
            Component.select('Number of Outlets', 'Select Number', ['numoutlets'], 2),
            Component.select('Combine Outlets', '', ['combine'], 3),

            Component.textField('Name', 'Enter Name', ['name']),
            Component.textField('Ip', 'Enter Ip', ['ip']),
            Component.textField('Key', 'Enter Key', ['key']),
            Component.textField('Id', 'Enter Id', ['id']),
            panel,
            Component.create('input', { type: 'text', readonly: '', style: 'margin: 10px 0; grid-column: 1 / -1;' }),
            footer,
        ]

        this.options = [
            Component.options('Select Type', this.dataSet[0]),
            Component.options('Select Image', this.dataSet[1], false, true, images),
            Component.options('Select Number', this.dataSet[2]),
            Component.options('Combine', this.dataSet[3])
        ]
    }

    setHtml(): DocumentFragment {
        const fragment = document.createDocumentFragment()
        const div = document.createElement('div')
        div.append(...this.options)

        this.container = document.createElement('div')
        this.removedDevices = []

        this.devices.forEach(device => {
            this.container.appendChild(this.createPanel(device))
        })
        this.container.className = 'automation'
        this.container.appendChild(this.templates[10].cloneNode(true))
        fragment.append(this.container, div)
        return fragment
    }

    handleMessage(data: any): void {
        if (data.event === 'foundDevices') {
            const toast = document.querySelector('.toast') as HTMLElement
            if (data.value) {
                toast.innerText = 'Devices Found'
                setTimeout(() => { toast.innerText = 'Restarting Server' }, 1500)
                setTimeout(() => location.reload(), 3000)
            } else {
                toast.innerText = 'No Devices Found'
                setTimeout(() => toast.classList.remove('active'), 1500)
            }
        }
    }

    handleClick(target: HTMLElement): void {
        if (target.classList.contains('selectedOption')) {
            this.activeSelect = target.parentElement
            this.openSelect(target.parentElement)
        } else if (target.classList.contains('option')) {
            this.handleSelectedOption(target)
        } else {
            this.closeOpenSelect()
        }

        switch (target.id) {
            case 'saveDevices':
                this.saveDevices()
                break
            case 'removeDevice':
                const device = target.parentElement
                if (device.id !== '') {
                    this.removedDevices.push(device.id)
                }
                device.parentNode.removeChild(device)
                break
            case 'addDevice':
                this.container.insertBefore(this.createPanel(), this.container.lastChild)
                break
            case 'findDevices':
                this.ws.send(JSON.stringify({ event: 'findDevices' }))
                const toast = document.querySelector('.toast') as HTMLElement
                toast.innerText = 'Searching for devices'
                toast.classList.add('active')
                break
        }
    }

    handleLongClick(target: HTMLElement): void { }

    createPanel(device: Device = { type: '', id: null, name: [null], image: [null] }) {
        const panel = this.templates[8].cloneNode(true) as HTMLElement
        panel.id = device.id
        panel.firstChild.appendChild(this.createSelect(0, device.type))
        this.updateDevice(panel.firstElementChild, device)
        return panel
    }

    updateDevice(panel: Element, device: Device) {
        if (!device.id) {
            device.ip = panel.querySelector('.ip') ? (<HTMLInputElement>panel.querySelector('.ip')).value : '';
            device.id = panel.querySelector('.id') ? (<HTMLInputElement>panel.querySelector('.id')).value : '';
            device.key = panel.querySelector('.key') ? (<HTMLInputElement>panel.querySelector('.key')).value : '';
            device.name = panel.querySelector('.name') ? [(<HTMLInputElement>panel.querySelector('.name')).value] : [''];
            device.image = panel.querySelector('.image') ? [(<HTMLInputElement>panel.querySelector('.image')).dataset.selected] : [''];
        }

        while (panel.firstChild !== panel.lastChild) {
            panel.removeChild(panel.lastChild);
        }

        switch (device.type) {
            case 'outlet':
            case 'dimmer':
                panel.append(
                    this.createTextField(4, device.name[0]),
                    this.createSelect(1, device.image[0]),
                    this.createTextField(5, device.ip),
                    this.createTextField(6, device.key),
                    this.createTextField(7, device.id));
                break
            case 'multioutlet':
                panel.append(
                    this.createTextField(5, device.ip),
                    this.createTextField(6, device.key),
                    this.createTextField(7, device.id),
                    this.createSelect(2, String(device.number) || ''),
                    this.createSelect(3, this.parseBool(device.combine) || 'false'));
                this.addMultiOutlet(panel, device);
                break
        }
    }


    addMultiOutlet(panel: Element, device: Device): void {
        const combine = (<HTMLElement>panel.childNodes[5].lastChild).dataset.selected === 'true'
        let numOutlets: number;
        if (combine) numOutlets = 1;
        else numOutlets = device.name.length;

        const diff = numOutlets - (panel.childElementCount - 6) / 3;
        if (diff > 0) {
            for (let i = 0; i < diff; i++) {
                const label = this.templates[9].cloneNode(true) as HTMLInputElement;
                label.value = 'Outlet ' + (numOutlets - diff + i + 1);
                panel.append(label, this.createTextField(4, device.name[i]), this.createSelect(1, device.image[i]));
            }
        } else {
            for (let i = 0; i < -diff * 3; i++) {
                panel.removeChild(panel.lastChild);
            }
        }
    }

    createSelect(type: number, selected: string): HTMLElement {
        const select = this.templates[type].cloneNode(true) as HTMLElement;
        if (selected !== '') {
            (<HTMLElement>select.lastElementChild.firstElementChild).innerText = this.dataSet[type][selected];
            (<HTMLElement>select.lastElementChild).dataset.selected = selected
        }
        return select
    }

    createTextField(fieldType: number, text: string): HTMLElement {
        const field = this.templates[fieldType].cloneNode(true) as HTMLElement
        (<HTMLInputElement>field.lastElementChild).value = text
        return field
    }

    closeOpenSelect(): void {
        const openOptions = document.querySelector('.open')
        if (openOptions) {
            openOptions.classList.remove('open')
        }
    }

    openSelect(select: HTMLElement): void {
        this.closeOpenSelect()
        const selected = select.dataset.selected
        const options = this.options[parseInt(select.dataset.type)]
        options.childNodes.forEach(o => {
            if (selected === (<HTMLElement>o).dataset.value) {
                (<HTMLElement>o).classList.add('selected')
            } else {
                (<HTMLElement>o).classList.remove('selected')
            }
        })
        options.classList.add('open')
        const rect = select.getBoundingClientRect();
        const optionsHeight = options.clientHeight
        const bottomDist = window.innerHeight - rect.top
        options.style.left = rect.left + 'px'
        options.style.width = select.offsetWidth + 'px'
        options.style.maxHeight = window.innerHeight - 78 + 'px'
        if (bottomDist < optionsHeight) {
            if (optionsHeight < window.innerHeight) {
                options.style.top = select.offsetTop + bottomDist - optionsHeight - 10 + 'px'
            } else {
                options.style.top = '68px'
            }
        } else {
            options.style.top = select.offsetTop + 'px'
        }
    }

    handleSelectedOption(option: HTMLElement): void {
        const options = option.parentElement
        if (!option.classList.contains('selected')) {
            const selectedOption = options.querySelector('.selected')
            if (selectedOption) {
                selectedOption.classList.remove('selected')
            }
            option.classList.add('selected');
            (<HTMLElement>this.activeSelect.firstChild).innerText = option.innerText;
            this.activeSelect.dataset.selected = option.dataset.value;
            if (this.activeSelect.classList.contains('type')) {
                this.updateDevice(this.activeSelect.parentElement.parentElement, { type: option.dataset.value, id: '', name: [''], image: [''] });
            } else if (this.activeSelect.classList.contains('numoutlets')) {
                const length = parseInt(option.dataset.value)
                this.addMultiOutlet(this.activeSelect.parentElement.parentElement, {
                    name: Array(length).fill(''), id: '', image: Array(length).fill(''), type: '',
                })
            } else if (this.activeSelect.classList.contains('combine')) {
                const parent = this.activeSelect.parentElement.parentElement
                const number = parseInt((<HTMLElement>parent.childNodes[4].lastChild).dataset.selected)
                this.addMultiOutlet(parent, {
                    name: Array(number).fill(''), id: '', image: Array(number).fill(''), type: '',
                })
            }
        }
        options.classList.remove('open')
    }

    saveDevices(): void {
        const updatedDevices: Device[] = []
        this.container.querySelectorAll('.panel').forEach(panel => {
            const v: any = []

            panel.querySelectorAll('.input').forEach(s => {
                if (s.classList.contains('select')) {
                    v.push((<HTMLElement>s).dataset.selected)
                } else {
                    v.push((<HTMLInputElement>s).value)
                }
            })

            if (v[0] === 'multioutlet') {
                const name = []
                const image = []
                const number = parseInt(v[4])
                const combine = v[5] === 'true'
                if (combine) {
                    name.push(v[6])
                    image.push(v[7])
                } else {
                    for (let i = 0; i < number; i++) {
                        name.push(v[6 + i * 2])
                        image.push(v[7 + i * 2])
                    }
                }
                updatedDevices.push({ type: v[0], ip: v[1], key: v[2], id: v[3], name, image, number, combine })
            } else if (v[0] === 'outlet' || v[0] === 'dimmer') {
                updatedDevices.push({ type: v[0], name: [v[1]], image: [v[2]], ip: v[3], key: v[4], id: v[5] })
            }
        })
        this.ws.send(JSON.stringify({ event: 'updateSettings', settings: updatedDevices, removed: this.removedDevices }))
        const toast = document.querySelector('.toast') as HTMLElement
        toast.innerText = 'Updating Settings'
        toast.classList.add('active')
        setTimeout(() => {
            toast.innerText = 'Restarting Server'
        }, 2000)
        setTimeout(() => toast.classList.remove('active'), 2000)
    }

    parseBool(bool: boolean): string {
        if (bool === true) return 'true'
        if (bool === false) return 'false'
    }
}
