import AbstractView from "./views/AbstractView";

export interface State {
    id: string;
    name: string;
    type: string;
    state: boolean;
    brightness?: number;
    data?: string;
    image: string;
}

export interface Device {
    id: string;
    name: string[];
    type: string;
    image: string[];
    key?: string;
    ip?: string;
    combine?: boolean;
    number?: number;
}
export interface Automation {
    id: string;
    trigger: Trigger;
    enabled: boolean;
    sequence: Entry[];
}

export interface Trigger {
    type: string;
    device?: string;
    state?: boolean;
    time?: string;
    offset?: number;
}

export interface Entry {
    type: string;
    device?: string[];
    state?: boolean;
    brightness?: number;
    if?: {
        device: string;
        state: boolean;
    },
    then?: Entry[];
    else?: Entry[];
    wait?: number;
}

export interface Home {
    states: State[];
    devices: Device[];
    automations: Automation[];
}

export interface User {
    layout: string[];
}

export interface Page {
    path: string;
    view: AbstractView;
}