export default class OpenAI {
  constructor() {
    this.chat = {
      completions: {
        // Placeholder to avoid runtime failures if override is not set during tests.
        create: async () => {
          throw new Error('OpenAI mock not configured');
        }
      }
    };
  }
}


