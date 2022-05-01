
interface DeviceState {
    id: string
    name: string
    image: string
    type: string
    state: boolean
    brightness?: number
    data?: string
}

interface Automation {
    id: string
    enabled: boolean
    weekdays: boolean[]
    trigger: Trigger
    sequence: string
}

// Automation Triggers
interface DeviceTrigger {
    type: 'device'
    device: string
    state: boolean
    time: string
}
interface TimeTrigger {
    type: 'time'
    time: string
}

interface SunriseTrigger {
    type: 'sunrise'
    offset: number
}

interface SunsetTrigger {
    type: 'sunset'
    offset: number
}

type Trigger = DeviceTrigger | TimeTrigger | SunriseTrigger | SunsetTrigger

// If Conditions
interface StateCondition {
    type: 'state'
    device: string
    state: boolean
}

interface RangeCondition {
    type: 'range'
    start: string
    end: string
}

type Condition = StateCondition | RangeCondition

// Automation Entries
interface EntryParent {
    id: string
    type: 'parent'
    parentId: string
    children: string[]
}

interface EntryDevice {
    id: string
    type: 'device'
    parentId: string
    device: string[]
    state: boolean
    brightness?: number
}

interface EntryWait {
    id: string
    type: 'wait'
    parentId: string
    wait: number
}

interface EntryIf {
    id: string
    type: 'if'
    parentId: string
    conditions: Condition[]
    thenSeq: string
}

interface EntryIfElse {
    id: string
    type: 'ifElse'
    parentId: string
    conditions: Condition[]
    thenSeq: string
    elseSeq: string
}

type Entry = EntryParent | EntryDevice | EntryWait | EntryIf | EntryIfElse
