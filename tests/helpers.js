export class MemoryCache {
  constructor(){
    this.entries = new Map()
  }

  key(input){
    return typeof input === 'string' ? input : input.url
  }

  async match(input){
    const response = this.entries.get(this.key(input))
    return response ? response.clone() : undefined
  }

  async put(input, response){
    this.entries.set(this.key(input), response.clone())
  }

  deleteWhere(fragment){
    for(const key of this.entries.keys()){
      if(key.includes(fragment)) this.entries.delete(key)
    }
  }
}

export function replaceGlobal(name, value){
  const previous = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  return () => {
    if(previous) Object.defineProperty(globalThis, name, previous)
    else delete globalThis[name]
  }
}

export function requestContext(url, options = {}){
  const pending = []
  return {
    context: {
      request: new Request(url, options),
      waitUntil(promise){ pending.push(promise) }
    },
    async settle(){ await Promise.all(pending) }
  }
}

export function silenceWarnings(){
  const previous = console.warn
  console.warn = () => {}
  return () => { console.warn = previous }
}
