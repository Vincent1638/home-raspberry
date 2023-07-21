import { State } from "../types";
import AbstractView from "./AbstractView";
import * as Component from "./Component";

export default class Dashboard extends AbstractView {
    ws: WebSocket;
    devices: State[];
    layout: string[];
    images: any;
    container: HTMLElement;
    disabledContainer: HTMLElement;
    cards: HTMLElement[];
    range: HTMLInputElement;
    label: HTMLElement;
    popover: HTMLElement;
    deviceId: string;
    firstClick: boolean;
    reorder: boolean;

    constructor(ws: WebSocket, devices: State[], layout: string[], images: any) {
        super();
        this.devices = devices;
        this.layout = layout;
        this.images = images;
        this.ws = ws;
    }

    setHtml(): DocumentFragment {
        this.container = Component.create('div', { class: 'container', id: 'active' });
        this.disabledContainer = Component.create('div', { class: 'container disabled', id: 'disabled' });
        this.cards = [];

        this.cards = this.devices.map(device => {
            const card = this.createCard(device);
            this.updateCard(card, device);
            return card;
        })
        this.sortCards();

        let placeholder: HTMLElement;
        document.addEventListener('dragover', event => event.preventDefault());
        document.addEventListener('dragend', event => (<HTMLElement>event.target).style.opacity = '1');
        document.addEventListener('dragstart', event => {
            dragImage.innerHTML = (<HTMLElement>event.target).innerHTML;
            dragImage.style.width = (<HTMLElement>event.target).offsetWidth - 12 + 'px';
            event.dataTransfer.setDragImage(dragImage, (<HTMLElement>event.target).offsetWidth / 2, (<HTMLElement>event.target).offsetHeight / 2);
            placeholder = <HTMLElement>event.target;
            (<HTMLElement>event.target).style.opacity = '0';
        }, false);

        document.addEventListener('dragenter', (event) => {
            if ((<HTMLElement>event.target).classList.contains('card')) {
                const parentNode = (<HTMLElement>event.target).parentNode
                if (parentNode.isSameNode(placeholder.parentNode) && (<HTMLElement>event.target).compareDocumentPosition(placeholder) === 2) {
                    parentNode.insertBefore(placeholder, (<HTMLElement>event.target).nextSibling)
                } else {
                    parentNode.insertBefore(placeholder, (<HTMLElement>event.target))
                }
            }
        });

        const rangeView = Component.create('div', { class: 'content' })
        this.label = Component.create('label', { style: 'width: 300px;' }, '100')
        this.popover = Component.create('div', { class: 'popover', style: 'visibility: hidden;' })
        this.range = Component.create('input', { type: "range", min: '0', max: '20' }) as HTMLInputElement
        rangeView.append(this.range, this.label)
        this.popover.appendChild(rangeView)

        this.range.addEventListener('change', () => {
            if (parseInt(this.range.value) === 0) {
                this.ws.send(JSON.stringify({ event: 'setDevice', id: this.deviceId, state: false, brightness: 10 }))
            } else {
                this.ws.send(JSON.stringify({
                    event: 'setDevice',
                    id: this.deviceId,
                    state: true,
                    brightness: parseInt(this.range.value) * 50
                }))
            }
        })

        this.range.addEventListener('input', () => {
            this.updateBrightness(parseInt(this.range.value) * 5)
        })

        const dragImage = Component.create('div', {
            class: 'card',
            style: 'position: absolute; top: -100px; left: -500px;'
        })

        const fragment = document.createDocumentFragment()
        fragment.append(this.container, this.disabledContainer, this.popover, dragImage)
        return fragment
    }

    createCard(device: State): HTMLElement {
        const card = Component.create('div', { class: 'card', id: device.id, 'data-type': device.type, draggable: false })
        card.style.animationDelay = -Math.random() + 's'
        card.append(Component.create('div', { class: 'image' }, this.images[device.image].svg),
            Component.create('div', { class: 'name' }, device.name),
            Component.create('div', { class: 'state' })
        )
        return card
    }

    sortCards(): void {
        this.cards.sort((a, b) => this.layout.indexOf(a.id) - this.layout.indexOf(b.id))
        this.cards.forEach(card => {
            if (this.layout.includes(card.id)) this.container.appendChild(card)
            else this.disabledContainer.appendChild(card)
        })
    }

    updateBrightness(value: number): void {
        if (value === 0) {
            this.label.innerText = 'Off'
        } else {
            this.label.innerText = value + '%'
        }
    }

    handleClick(target: HTMLElement): void {
        if (!this.reorder && target.classList.contains('card')) {
            switch (target.dataset.type) {
                case 'button':
                    this.ws.send(JSON.stringify({ event: 'updateButton', id: target.id }))
                    break
                case 'garage':
                    this.ws.send(JSON.stringify({ event: 'setGarage' }))
                    break
                case 'switch':
                    this.ws.send(JSON.stringify({ event: 'toggleSwitch', id: target.id }))
                    break
                case 'multioutlet':
                case 'outlet':
                case 'dimmer':
                    this.ws.send(JSON.stringify({ event: 'toggleDevice', id: target.id }))
            }
        } else if (this.reorder && !this.firstClick) {
            this.cards.forEach(card => {
                card.classList.remove('reorder')
                card.setAttribute('draggable', 'false')
            })
            this.disabledContainer.classList.add('disabled')
            this.reorder = false
            this.updateLayout()
        } else if (target.classList.contains("popover")) {
            this.popover.style.opacity = '0'
            this.popover.style.visibility = 'hidden'
        } else {
            this.firstClick = false
        }
    }

    handleLongClick(target: HTMLElement): void {
        if ((target.classList.contains('nav-header'))) {
            this.cards.forEach(card => {
                card.classList.add('reorder')
                card.setAttribute('draggable', 'true')
            })
            this.reorder = true
            this.firstClick = true
            this.disabledContainer.classList.remove('disabled')
        } else if (!this.reorder && target.dataset.type === 'dimmer') {
            this.deviceId = target.id
            this.range.value = target.dataset.value
            this.updateBrightness(parseInt(target.dataset.value) * 5)
            this.popover.style.visibility = 'visible'
            this.popover.style.opacity = '1'
        }
    }

    handleMessage(json: any): void {
        if (json.hasOwnProperty('type')) {
            const card = document.getElementById(json.id)
            if (!card) {
                return
            }
            this.updateCard(card, json)
        }
    }


    updateCard(card: HTMLElement, json: any): void {
        switch (json.type) {
            case 'switch':
            case 'outlet':
            case 'multioutlet':
                card.classList.toggle('inactive', !json.state)
                card.lastElementChild.innerHTML = json.state ? 'On' : 'Off'
                break
            case 'dimmer':
                card.classList.toggle('inactive', !json.state)
                card.setAttribute('data-value', String(json.brightness / 50))
                card.lastElementChild.innerHTML = json.state ? json.brightness / 10 + '%' : 'Off'
                break
            case 'garage':
                card.classList.toggle('inactive', !json.state)
                card.lastElementChild.innerHTML = json.data
                break
            case 'door':
                card.classList.toggle('inactive', !json.state)
                card.lastElementChild.innerHTML = json.state ? 'Open' : 'Closed'
                break
            case 'button':
                card.classList.toggle('inactive', true)
                card.lastElementChild.innerHTML = 'Connected'
                break
            case 'sensor':
                card.classList.toggle('inactive', !json.state)
                card.lastElementChild.innerHTML = json.state ? 'Active' : json.data
                break
        }
    }

    updateLayout(): void {
        const layout: string[] = []
        this.container.querySelectorAll('.card').forEach(card => {
            layout.push(card.id)
        })
        this.layout = layout
        this.ws.send(JSON.stringify({ event: 'updateLayout', layout: layout }))
    }
}