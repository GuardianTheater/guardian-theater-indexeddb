# GuardianTheaterIndexeddb

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 9.0.7.

## Getting Started

- Run `yarn install` for the needed dependencies

This project relies on an ancient version of `angular-devkit` which itself uses an ancient version of `webpack` which [defaults to the unsupported and insecure MD4](https://stackoverflow.com/questions/69394632/webpack-build-failing-with-err-ossl-evp-unsupported).
You have a few options:

- Fix it properly by updating and resolving all dependencies.
- Use an old Node.js version (e.g. with Node Version Manager)
- Enable legacy openssl providers by changing your environment flags e.g. with `$env:NODE_OPTIONS = "--openssl-legacy-provider"`
- You might be able to use `@angular-builders/custom-webpack` to specify the necessary webpack configs

## Creating an SSL certificate

Bungie requires Redirect URL to utilize any scheme except http. This example uses a self-signed certificate for local use.
You can manually create a certificate with `openssl req -new -x509 -newkey rsa:2048 -sha256 -nodes -days 3560 -keyout dev.key -out dev.crt`.

`ng serve --ssl` can also automatically create a certificate for you but it will only be valid for one month.

Alternatively you can use e.g. a [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) or a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

## Specify API keys

Create a typescript file holding your api keys in `./src/environments/keys.ts`. The schema is specified in `./src/environments/environment.ts` or you can use the following example:

```typescript
// Create a public OAuth Client Type application at https://www.bungie.net/en/Application
// You don't need any additional permissions, but make sure to set the redirect url and origin header.
// If you follow this example with a localhost instance both should be set to https://localhost:4200
export const bungieDev = {
  apiKey: 'ffffffffffffffffffffffffffffffff',
  clientId: '00000',
  redirect: "https://localhost:4200"
}

// Create a Twitch Application at https://dev.twitch.tv/console/apps
// Choose a confidential client type
// You can find the docs at https://dev.twitch.tv/docs/authentication/register-app/
export const twitchDev = {
  clientId: "ffffffffffffffffffffffffffffff",
  redirect: "https://localhost:4200",
  // Guardian Theater embeds Twitch content which is why you need to specify a "parent", i.e. the page on which the content is embedded on. "localhost" is sufficient for local deployments, but follow the docs for different setups:
  // https://dev.twitch.tv/docs/embed/everything/
  parent: "localhost"
}

// The xbox clip functionality is currently broken
export const xboxDev = {
  redirect: "",
  clientId: ""
}
```

## Start the development server

If you manually created a certificate you need to server using `ng serve --ssl --ssl-key .\dev.key --ssl-cert .\dev.crt` (point to wherever you saved your certificate files).

Otherwise use `ng serve --ssl` to automatically create a certificate with a one month expiration date.

Guardian Theater is now live at `https://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

The main logic of Guardian Theater is in `./src/app/sate/state.service.ts`

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
