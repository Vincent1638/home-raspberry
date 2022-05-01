import { initializeApp, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { firebaseToken } from './credentials.js'

initializeApp({
    credential: cert(firebaseToken),
    databaseURL: "https://home-9a55b-default-rtdb.firebaseio.com"
})

const db = getDatabase()
const usersRef = db.ref('users')
const devicesRef = db.ref('devices')
const automationsRef = db.ref('automations')

export const updateUserData = (username, data) => {
    return usersRef.child(username).update(data)
}

export const getUserData = (username) => {
    return new Promise(resolve => {
        usersRef.child(username).on('value', data => resolve(data.val()))
    })
}

export const getDevices = () => {
    return new Promise(resolve => {
        devicesRef.on('value', data => resolve(data.val()))
    })
}

export const upsertDevice = async (device, custom) => {
    return devicesRef.child(device.id).update({ ...device, custom })
}

export const deleteDevice = (id) => {
    return devicesRef.child(id).remove()
}

export const updateDeviceInfo = (id, info) => {
    return devicesRef.child(id).update(info)
}

export const getAutomations = () => {
    return new Promise(resolve => {
        automationsRef.on('value', data => resolve(data.val()))
    })
}

export const deleteAutomation = (id) => {
    return automationsRef.child(id).remove()
}

export const upsertAutomation = async (automation) => {
    return automationsRef.child(automation.id).set(automation)
}