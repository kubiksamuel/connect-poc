export type WeatherParams = {
  location: string;
};

export function getWeather(params: WeatherParams): string {
  const { location } = params;
  return `The weather in ${location} is 24°C, sunny. ☀️`; // Simulated response
}

export const functionSpecs = [
  {
    name: "getWeather",
    description: "Get the current weather for a location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and country (e.g., 'Bratislava, Slovakia')",
        },
      },
      required: ["location"],
    },
  },
];
