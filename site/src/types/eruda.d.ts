declare module 'eruda' {
  interface ErudaOptions {
    container?: HTMLElement
    tool?: string[]
    autoScale?: boolean
    useShadowDom?: boolean
    defaults?: {
      displaySize?: number
      transparency?: number
      theme?: string
    }
  }

  interface ErudaInstance {
    init(options?: ErudaOptions): void
    show(): void
    hide(): void
    destroy(): void
    get(name: string): any
    add(plugin: any): void
    remove(name: string): void
  }

  const eruda: ErudaInstance
  export default eruda
}