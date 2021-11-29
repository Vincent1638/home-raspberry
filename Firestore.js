const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_CREDENTIALS)) })

const db = getFirestore()
const usersRef = db.collection('users')
const devicesRef = db.collection('devices')
const automationsRef = db.collection('automations')


const updateUser = (username, data) => {
    return usersRef.doc(username).update(data)
}

const getUserDataTest = async (username) => {
    const doc = await usersRef.doc(username).get()
    return doc.data();
}

const getDevices = async (custom) => {
    const snapshot = await devicesRef.where('custom', '==', custom).get()
    return snapshot.docs.map(doc => doc.data())
}

const upsertDevice = async (device, custom) => {
    return devicesRef.doc(device.id).set({ ...device, custom }, { merge: true })
}

const updateDeviceInfo = (id, info) => {
    return devicesRef.doc(id).update(info)
}

const getAutomations = async () => {
    const snapshot = await automationsRef.get()
    return snapshot.docs.map(doc => doc.data())
}

const upsertAutomation = async (automation) => {
    if (automation.id !== '') {
        return automationsRef.doc(automation.id).update(automation)
    } else {
        return automationsRef.add(automation)
    }
}

module.exports = {
    updateUser,
    getUserDataTest,
    getDevices,
    upsertDevice,
    updateDeviceInfo,
    getAutomations,
    upsertAutomation,
}