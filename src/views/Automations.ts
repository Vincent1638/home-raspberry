import { Automation, Trigger, Entry } from "../types";
import AbstractView from "./AbstractView";
import * as Component from "./Component";


export default class extends AbstractView {
    ws: WebSocket
    automations: Automation[]
    automationsData: any
    dimmableDevices: string[]
    templates: HTMLElement[]
    options: HTMLElement[]
    container: HTMLDivElement
    removedAutomations: string[]
    activeSelect: HTMLElement

    constructor(ws: WebSocket, automations: Automation[], automationsData: any, dimmableDevices: string[]) {
        super()
        this.automationsData = automationsData
        this.automations = automations
        this.dimmableDevices = dimmableDevices
        this.ws = ws

        const expandButton = Component.create('div', { class: 'expandButton', id: 'expandAutomation' })
        expandButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M441.9 167.3l-19.8-19.8c-4.7-4.7-12.3-4.7-17 0L224 328.2 42.9 147.5c-4.7-4.7-12.3-4.7-17 0L6.1 167.3c-4.7 4.7-4.7 12.3 0 17l209.4 209.4c4.7 4.7 12.3 4.7 17 0l209.4-209.4c4.7-4.7 4.7-12.3 0-17z"></path></svg>'

        const saveButton = Component.create('button', { class: 'button solid save', id: 'saveAutomations' }, 'Save')
        saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="height: 16px; margin-right: 8px;" fill="#FFFFFF"><path d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM272 80v80H144V80h128zm122 352H54a6 6 0 0 1-6-6V86a6 6 0 0 1 6-6h42v104c0 13.255 10.745 24 24 24h176c13.255 0 24-10.745 24-24V83.882l78.243 78.243a6 6 0 0 1 1.757 4.243V426a6 6 0 0 1-6 6zM224 232c-48.523 0-88 39.477-88 88s39.477 88 88 88 88-39.477 88-88-39.477-88-88-88zm0 128c-22.056 0-40-17.944-40-40s17.944-40 40-40 40 17.944 40 40-17.944 40-40 40z"></path></svg>Save'

        const footer = document.createElement('div')
        footer.append(Component.create('button', { class: 'button solid', id: 'addAutomation' }, 'Add Automation'), saveButton)

        this.templates = [
            Component.panel(),
            Component.sequence(),
            Component.entry(),
            Component.create('div', { class: 'condition' }),
            Component.textField('Time', '00:00 - 24:00'),
            Component.textField('Time', 'Start Time'),
            Component.textField('Wait', 'Enter Delay'),
            Component.textField('Offset', 'None'),
            Component.select('Device', 'Select Device', [], 0),
            Component.select('Device', 'Select Device', ['tuyaSelect'], 1),
            Component.select('Trigger', 'Select Trigger', ['selectTrigger'], 2),
            Component.select('Option', 'Select Option', ['selectOption'], 3),
            Component.select('Brightness', 'Set Brightness', [], 4),
            Component.select('State', 'Select State Trigger', [], 5),
            Component.select('Condition', 'Select State', [], 6),
            Component.select('State', 'Select State', [], 7),
            Component.create('input', { type: 'text', value: 'Then', readonly: '', style: 'margin: 10px 0;' }),
            Component.create('input', { type: 'text', value: 'Else', readonly: '', style: 'margin: 10px 0;' }),
            Component.create('button', { class: 'button', id: 'removeAutomation' }, 'Remove Automation'),
            Component.create('button', { class: 'button', id: 'enabledState' }, 'Enabled'),
            footer,
            expandButton
        ]

        this.options = [
            Component.options('Select Device', this.automationsData[0]),
            Component.options('Select Device', this.automationsData[1], true),
            Component.options('Select Trigger', this.automationsData[2]),
            Component.options('Select Option', this.automationsData[3]),
            Component.options('Set Brightness', this.automationsData[4]),
            Component.options('Select State Trigger', this.automationsData[5]),
            Component.options('Select State', this.automationsData[6]),
            Component.options('Select State', this.automationsData[7])
        ]
    }

    setHtml(): DocumentFragment {
        const fragment = document.createDocumentFragment()
        this.container = document.createElement('div')
        this.removedAutomations = []

        this.automations.forEach(automation => {
            this.container.appendChild(this.loadAutomation(automation))
        })
        this.container.appendChild(this.templates[20].cloneNode(true))
        this.container.className = 'automation'

        const div = document.createElement('div')
        div.append(...this.options)
        fragment.append(this.container, div)
        return fragment
    }

    handleClick(target: HTMLElement): void {
        if (target.classList.contains('selectedOption')) {
            this.activeSelect = target.parentNode as HTMLElement
            this.openSelect(target.parentElement)
        } else if (target.classList.contains('option')) {
            this.handleSelectedOption(target)
        } else {
            this.closeOpenSelect()
        }

        switch (target.id) {
            case 'addEntry':
                const sequence = target.parentNode.parentNode
                sequence.insertBefore(this.loadEntry(), sequence.lastChild)
                break
            case 'removeButton':
                target.parentNode.parentNode.removeChild(target.parentNode)
                break
            case 'enabledState':
                target.innerText = target.classList.toggle('disabled') ? 'Disabled' : 'Enabled'
                break
            case 'removeAutomation':
                const auto = target.parentElement.parentElement.parentElement
                if (auto.id !== '') { this.removedAutomations.push(auto.id) }
                auto.parentElement.removeChild(auto)
                break
            case 'addAutomation':
                this.container.insertBefore(this.loadAutomation(), this.container.lastChild)
                break
            case 'saveAutomations':
                this.saveAutomations()
                break
            case 'expandAutomation':
                const expanded = target.classList.toggle('expanded')
                target.parentElement.parentElement.classList.toggle('expanded', expanded)
                break
        }
    }

    handleLongClick(target: HTMLElement): void { }

    handleMessage(data: any): void { }

    loadAutomation(automation: Automation = { id: null, trigger: { type: null }, enabled: true, sequence: [{ type: null }] }): HTMLElement {
        let panel = this.templates[0].cloneNode(true) as HTMLElement;
        if (automation.id) panel.id = String(automation.id);
        this.loadTrigger(<HTMLElement>panel.firstElementChild, automation.trigger);
        panel.appendChild(this.loadSequence(automation.sequence));
        const enabledButton = this.templates[19].cloneNode(true) as HTMLElement;
        if (!automation.enabled && automation.enabled != null) {
            enabledButton.innerText = 'Disabled';
            enabledButton.classList.add('disabled');
        }
        panel.lastElementChild.lastElementChild.classList.add('footer')
        panel.lastElementChild.lastElementChild.append(
            this.templates[18].cloneNode(true),
            enabledButton,
            document.createElement('div'),
            this.templates[21].cloneNode(true),
        );
        return panel;
    }

    loadTrigger(div: HTMLElement, trigger: Trigger): HTMLElement {
        div.appendChild(this.createSelect(10, [trigger.type]))
        this.updateTrigger(div, trigger)
        return div
    }

    updateTrigger(div: HTMLElement, trigger: Trigger): void {
        while (div.lastChild !== div.firstChild) {
            div.removeChild(div.lastChild)
        }
        switch (trigger.type) {
            case 'device':
                div.append(this.createSelect(8, [trigger.device]),
                    this.createSelect(13, [this.parseBool(trigger.state)]),
                    this.createTextField(4, trigger.time))
                break
            case 'time':
                div.append(this.createTextField(5, trigger.time))
                break
            case 'sunrise':
            case 'sunset':
                div.append(this.createTextField(7, this.parseTime(trigger.offset)))
                break
        }
    }

    loadSequence(sequence: Entry[] = [{ type: null }]): HTMLElement {
        const div = this.templates[1].cloneNode(true) as HTMLElement
        if (sequence.length === 0) {
            div.insertBefore(this.loadEntry(sequence[0]), div.lastChild)
        }
        sequence.forEach(entry => {
            div.insertBefore(this.loadEntry(entry), div.lastChild)
        })
        return div
    }

    loadEntry(entry: Entry = { type: null }): HTMLElement {
        let entryDiv = this.templates[2].cloneNode(true) as HTMLElement
        this.updateEntry(entryDiv, entry)
        return entryDiv
    }

    updateEntry(entryDiv: HTMLElement, entry: Entry): void {
        const div = entryDiv.lastElementChild
        const row = entryDiv.lastElementChild.firstElementChild
        row.appendChild(this.createSelect(11, [entry.type]))
        while (row.lastChild !== row.firstChild) {
            row.removeChild(row.lastChild)
        }
        while (div.lastChild !== div.firstChild) {
            div.removeChild(div.lastChild)
        }
        switch (entry.type) {
            case 'device':
                const disabled = entry.device ? !entry.device.some(id => this.dimmableDevices.includes(id)) : true
                row.append(this.createSelect(9, entry.device),
                    this.createSelect(15, [this.parseBool(entry.state)]),
                    this.createSelect(12, entry.brightness ? [entry.brightness.toString()] : [], disabled))
                break
            case 'if':
                let c1 = this.templates[3].cloneNode(true) as HTMLElement
                c1.append(this.createSelect(8, entry.if ? [entry.if.device] : [undefined]),
                    this.createSelect(14, entry.if ? [this.parseBool(entry.if.state)] : [undefined]))
                row.appendChild(c1)
                div.append(this.templates[16].cloneNode(true), this.loadSequence(entry.then))
                break
            case 'ifElse':
                let c2 = this.templates[3].cloneNode(true) as HTMLElement
                c2.append(this.createSelect(8, entry.if ? [entry.if.device] : [undefined]),
                    this.createSelect(14, entry.if ? [this.parseBool(entry.if.state)] : [undefined]))
                row.appendChild(c2)
                div.append(this.templates[16].cloneNode(true), this.loadSequence(entry.then),
                    this.templates[17].cloneNode(true), this.loadSequence(entry.else))
                break
            case 'wait':
                row.append(this.createTextField(6, this.parseTime(entry.wait)))
                break
        }
    }

    createSelect(selectType: number, selected: string[] = [], disabled = false): HTMLElement {
        const select = this.templates[selectType].cloneNode(true) as HTMLElement;
        if (disabled) select.lastElementChild.classList.add('disabled');
        const type = (<HTMLElement>select.lastElementChild).dataset.type;
        if (selected[0] != null) {
            (<HTMLElement>select.lastChild.firstChild).innerText = selected.map(s => this.automationsData[type][s]).join(', ');
            (<HTMLElement>select.lastChild).dataset.selected = selected.join();
        }
        return select
    }

    createTextField(fieldType: number, text = ''): HTMLElement {
        const field = this.templates[fieldType].cloneNode(true) as HTMLElement;
        (<HTMLInputElement>field.lastChild).value = text;
        return field;
    }


    openSelect(select: HTMLElement): void {
        this.closeOpenSelect();
        const selected = select.dataset.selected.split(',');
        const options = this.options[parseInt(select.dataset.type)];
        options.childNodes.forEach(o => {
            if (selected.includes((<HTMLInputElement>o).dataset.value)) {
                (<HTMLInputElement>o).classList.add('selected')
            } else {
                (<HTMLInputElement>o).classList.remove('selected')
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
        const options = option.parentElement;
        if (options.classList.contains('multiple')) {
            option.classList.toggle('selected')
            const selected = options.querySelectorAll('.selected');
            let values: string[] = []
            selected.forEach(s => {
                values.push((<HTMLElement>s).dataset.value)
            })
            if (values.length === 0) {
                this.activeSelect.firstElementChild.innerHTML = options.firstElementChild.innerHTML
            } else {
                this.activeSelect.firstElementChild.innerHTML = values.map(v => this.automationsData[this.activeSelect.dataset.type][v]).join(', ')
            }
            this.activeSelect.dataset.selected = values.join()
            this.updateRow(values)
        } else {
            if (!option.classList.contains('selected')) {
                const selectedOption = options.querySelector('.selected');
                if (selectedOption) { selectedOption.classList.remove('selected'); }
                option.classList.add('selected');
                this.activeSelect.firstElementChild.innerHTML = option.innerHTML;
                this.activeSelect.dataset.selected = option.dataset.value
                this.updateRow([option.dataset.value])
            }
            options.classList.remove('open')
        }
    }

    closeOpenSelect(): void {
        const openOptions = document.querySelector('.open')
        if (openOptions) {
            openOptions.classList.remove('open')
        }
    }

    updateRow(values: string[]): void {
        if (this.activeSelect.classList.contains('selectTrigger')) {
            this.updateTrigger(this.activeSelect.parentElement.parentElement, { type: values[0] })
        } else if (this.activeSelect.classList.contains('selectOption')) {
            this.updateEntry(this.activeSelect.parentElement.parentElement.parentElement.parentElement, { type: values[0] })
        } else if (this.activeSelect.classList.contains('tuyaSelect')) {
            this.activeSelect.parentElement.parentElement.lastElementChild.lastElementChild.classList.toggle('disabled', !values.some(v => this.dimmableDevices.includes(v)))
        }
    }

    saveAutomations(): void {
        const updatedAutomations: Automation[] = []
        const panels = this.container.querySelectorAll('.panel')
        panels.forEach(automation => {
            updatedAutomations.push({
                id: automation.id,
                enabled: !automation.querySelector('#enabledState').classList.contains('disabled'),
                trigger: this.getTrigger(automation.querySelector('#trigger')),
                sequence: this.getSequence(automation.querySelector('#sequence'))
            })
        })
        this.ws.send(JSON.stringify({ event: 'updateAutomations', automations: updatedAutomations, removed: this.removedAutomations }))
        const toast = document.querySelector('.toast')
        toast.innerHTML = 'Updating Automations'
        toast.classList.add('active')
        setTimeout(() => { toast.innerHTML = 'Restarting Server' }, 2000)
        setTimeout(() => toast.classList.remove('active'), 4000)
    }

    getTrigger(trigger: HTMLElement): Trigger {
        const selects = trigger.querySelectorAll('.input')
        const v: any = []
        selects.forEach(s => {
            if (s.classList.contains('select')) {
                v.push(this.getSelected(s))
            } else {
                v.push((<HTMLInputElement>s).value === '' ? undefined : (<HTMLInputElement>s).value)
            }
        })
        switch (v[0][0]) {
            case 'device':
                return { type: v[0][0], device: v[1][0], state: v[2][0] === 'true', time: v[3] }
            case 'time':
                return { type: v[0][0], time: v[1] }
            case 'sunrise':
            case 'sunset':
                return { type: v[0][0], offset: this.getTime(v[1]) }
        }
    }

    getSequence(sequence: HTMLElement): Entry[] {
        const entries = sequence.querySelectorAll(':scope>div>div>.row')
        const a: Entry[] = []
        entries.forEach(e => {
            const v: any = []
            e.childNodes.forEach(s => {
                if ((<HTMLElement>s.lastChild).classList.contains('select')) {
                    v.push(this.getSelected(s.lastChild))
                } else {
                    v.push((<HTMLInputElement>s.lastChild).value === '' ? undefined : (<HTMLInputElement>s.lastChild).value)
                }
            })
            switch (v[0][0]) {
                case 'device':
                    a.push({ type: v[0][0], device: v[1], state: v[2][0] === 'true', brightness: isNaN(v[3][0]) ? undefined : parseInt(v[3][0]) })
                    break
                case 'if':
                    const c1: any = []
                    e.lastChild.childNodes.forEach(n => c1.push(this.getSelected(n.lastChild)[0]))
                    a.push({ type: v[0][0], if: { device: c1[0], state: c1[1] === 'true' }, then: this.getSequence(e.parentNode.childNodes[2] as HTMLElement) })
                    break
                case 'ifElse':
                    const c2: any = []
                    e.lastChild.childNodes.forEach(n => c2.push(this.getSelected(n.lastChild)[0]))
                    a.push({
                        type: v[0][0],
                        if: { device: c2[0], state: c2[1] === 'true' },
                        then: this.getSequence(e.parentNode.childNodes[2] as HTMLElement),
                        else: this.getSequence(e.parentNode.childNodes[4] as HTMLElement)
                    })
                    break
                case 'wait':
                    a.push({ type: v[0][0], wait: this.getTime(v[1]) })
                    break
            }
        })
        return a
    }

    getSelected(select: Node): string[] {
        const values = (<HTMLElement>select).dataset.selected
        if (values === '') return [undefined]
        return values.split(',')
    }

    getTime(time: string): number {
        switch (time.slice(-1).toLowerCase()) {
            case 's':
                return parseInt(time.slice(0, -1))
            case 'm':
                return parseInt(time.slice(0, -1)) * 60
            case 'h':
                return parseInt(time.slice(0, -1)) * 60 * 60
            default:
                return parseInt(time)
        }
    }

    parseTime(time: number): string {
        if (time % 3600 === 0) {
            return time / 3600 + 'h'
        } else if (time % 60 === 0) {
            return time / 60 + 'm'
        } else if (time) {
            return time + 's'
        } else {
            return ''
        }
    }

    parseBool(bool: boolean): string {
        if (bool === true) return 'true'
        if (bool === false) return 'false'
    }
}