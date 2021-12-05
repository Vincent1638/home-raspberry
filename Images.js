const puppeteer = require("puppeteer")
const images = {}
const type = 'far'

const loadPage = async (name, url, browser) => {
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0);
    await page.goto("https://fontawesome.com/v5.15/icons/" + url)

    const data = await page.evaluate((url) => {
        const nodes = []
        const pathAttr = ["fill", "class"]
        const svgAttr = ["aria-hidden", "data-prefix", "data-icon", "role", "class", "focusable"]

        const childNodes = document.querySelectorAll('[data-icon=\"' + url + '\"] > path, [data-icon=\"' + url + '\"] > g')
        childNodes.forEach(node => nodes.push(node.parentNode))

        const filteredNodes = {}
        nodes.forEach(node => {
            const prefix = node.dataset.prefix
            svgAttr.forEach(a => {
                node.removeAttribute(a)
            })
            pathAttr.forEach(a => {
                node.firstChild?.removeAttribute(a)
            })
            if (prefix) filteredNodes[prefix] = node.outerHTML
        })
        return filteredNodes
    }, url)

    images[url] = { name, svg: data[type] }
}

const getImages = async (imageArray) => {
    try {
        const browser = await puppeteer.launch()
        await Promise.all(imageArray.map(image => loadPage(image[0], image[1], browser)))
        await browser.close()
    } catch (e) {
        console.log(e)
    }
    return images
}

module.exports = { getImages }