export function select(label: string, defaultOption: string, classes: string[], selectType: number) {
    const div = document.createElement('div')
    const title = create('label', {}, label)
    const select = create('div', { class: 'select input ' + classes, 'data-type': selectType, 'data-selected': '' })
    const option = create('div', { class: 'option selectedOption' }, defaultOption)
    const arrow = create('div', { class: 'arrow' }, '\u25Bf')
    select.append(option, arrow)
    div.append(title, select)
    return div
}
export function options(defaultOption: string, options: any, multiple = false, image = false, images: any = {}) {
    const div = create('div', { class: multiple ? 'options multiple' : 'options' })
    const defOption = create('div', { class: 'option disabled', 'data-value': 'none', style: defaultOption != 'Set Brightness' ? 'pointer-events: none' : '' }, defaultOption)
    div.appendChild(defOption)
    for (let key in options) {
        const option = create('div', { class: 'option', style: image ? 'padding-left: 30px;' : '', 'data-value': key }, options[key])
        if (multiple || image) {
            option.appendChild(create('div', { class: image ? 'image' : 'check' }, image ? images[key].svg : ''))
        }
        div.appendChild(option)
    }
    return div
}
export function textField(label: string, defaultText: string, classes = ['']) {
    const div = document.createElement('div')
    const title = create('label', {}, label)
    const input = create('input', { class: 'input ' + classes, type: 'text', placeholder: defaultText })
    div.append(title, input)
    return div
}
export function panel() {
    const div = create('div', { class: 'panel' })
    const row = create('div', { class: 'row', id: 'trigger' })
    const input = create('input', { type: 'text', value: 'Animation Sequence', readonly: '', style: 'margin: 10px 0;' })
    div.append(row, input)
    return div
}
export function sequence() {
    const div = create('div', { id: 'sequence' })
    const margin = create('div', { style: 'margin-top: 10px;' })
    const button = create('button', { class: 'button', id: 'addEntry' }, 'Add')
    margin.appendChild(button)
    div.appendChild(margin)
    return div
}
export function entry() {
    const div = create('div', { class: 'entryContainer' })
    const button = create('div', { class: 'removeButton', id: 'removeButton' })
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M193.94 256L296.5 153.44l21.15-21.15c3.12-3.12 3.12-8.19 0-11.31l-22.63-22.63c-3.12-3.12-8.19-3.12-11.31 0L160 222.06 36.29 98.34c-3.12-3.12-8.19-3.12-11.31 0L2.34 120.97c-3.12 3.12-3.12 8.19 0 11.31L126.06 256 2.34 379.71c-3.12 3.12-3.12 8.19 0 11.31l22.63 22.63c3.12 3.12 8.19 3.12 11.31 0L160 289.94 262.56 392.5l21.15 21.15c3.12 3.12 8.19 3.12 11.31 0l22.63-22.63c3.12-3.12 3.12-8.19 0-11.31L193.94 256z"></path></svg>'
    const container = document.createElement('div')
    const row = create('div', { class: 'row', id: 'entry' })
    container.appendChild(row)
    div.append(button, container)
    return div
}
export function create(type: string, attributes: any = {}, text?: string) {
    const doc = document.createElement(type)
    for (let key in attributes) {
        doc.setAttribute(key, attributes[key])
    }
    if (text)
        doc.innerHTML = text
    return doc
}

export function addButton() {
    const button = create('button', { class: 'button add', id: 'saveAutomations' }, 'Save')
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="height: 16px; margin-right: 8px;" fill="#FFFFFF"><path d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM272 80v80H144V80h128zm122 352H54a6 6 0 0 1-6-6V86a6 6 0 0 1 6-6h42v104c0 13.255 10.745 24 24 24h176c13.255 0 24-10.745 24-24V83.882l78.243 78.243a6 6 0 0 1 1.757 4.243V426a6 6 0 0 1-6 6zM224 232c-48.523 0-88 39.477-88 88s39.477 88 88 88 88-39.477 88-88-39.477-88-88-88zm0 128c-22.056 0-40-17.944-40-40s17.944-40 40-40 40 17.944 40 40-17.944 40-40 40z"></path></svg>Save'
    return button
}

export default create