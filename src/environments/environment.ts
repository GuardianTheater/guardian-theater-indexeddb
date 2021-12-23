import { bungieDev, twitchDev, xboxDev } from './keys'

export const environment: {
  production: boolean
  bungie: {
    apiKey: string
    clientId: string
    redirect: string
  }
  twitch: {
    clientId: string
    redirect: string
    parent: string
  }
  xbox: {
    redirect: string
    clientId: string
  }
} = {
  production: false,
  bungie: bungieDev,
  twitch: twitchDev,
  xbox: xboxDev,
}
