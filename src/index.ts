import { User, Home, Page } from "./types"
import AbstractView from "./views/AbstractView"
import Dashboard from "./views/Dashboard"
import Automations from "./views/Automations"
import Settings from "./views/Settings"
import images from "./images"
import './index.css'

const app = document.querySelector("#app")

let webSocket: WebSocket
let longPress: NodeJS.Timeout
let home: Home
let user: User
let views: Page[]
let view: AbstractView

function startApp() {
    views = [
        { path: '/', view: new Dashboard(webSocket, home.states, user.layout, images) },
        { path: '/automations', view: new Automations(webSocket, home.automations, getDataAuto(), getDimable()) },
        { path: '/settings', view: new Settings(webSocket, home.devices, getDataSet(), images) }
    ]
    router()
    createSnowfakes()
}

function navigateTo(url: string): void {
    history.pushState(null, null, url)
    router()
    setFallTime()
}

function router(): void {
    while (app.hasChildNodes()) {
        app.removeChild(app.lastChild)
    }
    view = views.find(v => v.path === location.pathname).view
    if (!view) view = views[0].view
    app.appendChild(view.setHtml())
}

window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
    let pointerDown = false

    window.addEventListener("click", e => {
        const target = e.target as HTMLElement
        if (target.matches("[data-link]")) {
            e.preventDefault();
            navigateTo((<HTMLAnchorElement>target).href);
        }
	
	if (target.id === 'mode') {
            target.lastElementChild.classList.toggle('active')
        } else if (target.parentElement !== null && target.parentElement.id === 'modeOptions') {
            document.body.className = target.id
            webSocket.send(JSON.stringify({ event: 'updateMode', mode: target.id }))
        } else {
            document.getElementById('modeOptions').classList.toggle('active', false)
        }
        view.handleClick(target)
    });

    document.addEventListener('pointerout', () => {
        if (pointerDown) clearTimeout(longPress)
    })

    document.addEventListener('pointerup', () => {
        pointerDown = false
        clearTimeout(longPress)
    })

    document.addEventListener('pointerdown', (event) => {
        pointerDown = true
        longPress = setTimeout(() => {
            view.handleLongClick(<HTMLElement>event.target)
        }, 500)
    }, true)
});


function startWebSocket(): void {
    webSocket = new WebSocket(location.origin.replace(/^http/, 'ws'))
    webSocket.onopen = () => console.log('WebSocket Connected.')
    webSocket.onclose = () => { setTimeout(startWebSocket, 10000) }
    webSocket.onmessage = (event) => {
        if (isJson(event.data)) {
            const json = JSON.parse(event.data)
            console.log(json)

            if (json.hasOwnProperty('type')) {
                let index = home.states.findIndex(d => d.id === json.id)
                for (let key in json) {
                    (<any>home.states[index])[key] = json[key]
                }
            }

            if (json.event === 'homeData') {
                home = json.data
                startApp()
            } else if (json.event === 'reload') {
                location.reload()
            } else if (json.event === 'userData') {
                user = json.data
            } else if (json.event === 'updateLayout') {
                user.layout = json.layout
            } else {
                view.handleMessage(json)
            }
        }
    }
}

startWebSocket()

function getDataAuto(): any {
    const allDevices: any = {}
    const tuyaDevices: any = {}

    home.states.forEach(d => {
        allDevices[d.id] = d.name
        if (d.type === 'dimmer' || d.type === 'multioutlet' || d.type === 'outlet') {
            tuyaDevices[d.id] = d.name
        }
    });

    return [
        allDevices,
        tuyaDevices,
        { device: 'Device', time: 'Time', sunset: 'Sunset', sunrise: 'Sunrise' },
        { device: 'Device', if: 'If', ifElse: 'If else', wait: 'Wait' },
        { '100': '10%', '200': '20%', '300': '30%', '400': '40%', '500': '50%', '600': '60%', '700': '70%', '800': '80%', '900': '90%', '1000': '100%' },
        { true: 'Turns On', false: 'Turns Off' },
        { true: 'Is On', false: 'Is Off' },
        { true: 'Turn On', false: 'Turn Off' }
    ]
}

function getDataSet(): any {
    const selectImages: { [key: string]: string } = {};
    for (let key in images) {
        selectImages[key] = images[key].name;
    }
    return [
        { dimmer: 'Dimmer', multioutlet: 'Multi Outlet', outlet: 'Outlet' },
        selectImages,
        { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' },
        { true: 'Yes', false: 'No' }
    ]
}

function getDimable(): string[] {
    return home.states.filter(d => d.type === 'dimmer').map(d => d.id)
}

function isJson(str: string): boolean {
    try {
        JSON.parse(str)
        return true
    } catch (e) {
        return false
    }
}

const container = document.getElementById('snowContainer')
const snowflake = document.createElement('div')
snowflake.classList.add('snowflake')
snowflake.innerText = '❆'

const snowflakes: HTMLElement[] = []
const numberOfFlakes = 10
const placements: string[] = []
const offsets: string[] = []

const createSnowfakes = () => {
    for (let i = 0; i < numberOfFlakes; i++) {
        placements.push(100 / numberOfFlakes * i + '%')
        offsets.push(i * 1 + 's, ' + (-Math.random() * 10) + 's')
        const flake = snowflake.cloneNode(true) as HTMLElement
        snowflakes.push(flake)
    }
    snowflakes.forEach(flake => {
        const placement = placements.splice(Math.floor(Math.random() * placements.length), 1)[0]
        const delay = offsets.splice(Math.floor(Math.random() * offsets.length), 1)[0]
        flake.style.animationDelay = delay
        flake.style.left = placement
    })
    container.append(...snowflakes)
}


const setFallTime = () => {
    const height = Math.max(window.innerHeight, app.clientHeight)
    const scale = height / window.innerHeight;
    const duration = 10 * scale + 's, 4s'
    container.style.height = height + 'px'
    snowflakes.forEach(flake => flake.style.animationDuration = duration)
}
