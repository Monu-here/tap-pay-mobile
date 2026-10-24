module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_PLIST ?? config.ios?.googleServicesFile,
    },
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
      ...(googleMapsApiKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: {
                ...config.android?.config?.googleMaps,
                apiKey: googleMapsApiKey,
              },
            },
          }
        : {}),
    },
  };
};
