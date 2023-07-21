export default abstract class AbstractView {
    abstract setHtml(): DocumentFragment
    abstract handleMessage(message: any): void
    abstract handleClick(event: HTMLElement): void
    abstract handleLongClick(event: HTMLElement): void
}