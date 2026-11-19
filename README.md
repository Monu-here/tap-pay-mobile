# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Gantabya Pay API and Live Tracking

Set `EXPO_PUBLIC_API_BASE_URL` to the full versioned API URL, including `/api/v1`.
Use `https://gantabyapayapi.devnextechnology.com/api/v1` for production. For a
physical phone on a local network, use the development computer's LAN
address or `.local` hostname; `localhost` and `127.0.0.1` refer to the phone
itself. The Laravel development server must be reachable from the device and
the phone and computer must be on a network that permits peer connections.

Live bus tracking uses reported API coordinates and `react-native-maps` with
the Google Maps provider; it does not simulate bus movement. For native
development/store builds, supply `GOOGLE_MAPS_API_KEY` when resolving the Expo
config. `app.config.js` configures the key for Android and iOS without
committing it. Rebuild the native app after changing the provider or key.
Restrict the key in Google Cloud to the app's Android package/iOS bundle ID and
the required Maps SDKs, and enable billing as required by Google. Do not put
provider keys in source control. GPS sharing is foreground-only and pauses
when the driver app leaves the foreground.

Firebase messaging builds use local `google-services.json` and
`GoogleService-Info.plist` files when available. For EAS builds, add the files
as file-type secret environment variables named `GOOGLE_SERVICES_JSON` and
`GOOGLE_SERVICES_PLIST` in the matching EAS environment.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
