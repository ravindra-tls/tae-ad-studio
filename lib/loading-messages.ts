export const loadingMessages: string[] = [
  "Mixing ancient herbs with modern pixels...",
  "Your ad is steeping like a fine Ayurvedic oil...",
  "Consulting the 5,000-year-old recipe book...",
  "Adding the perfect pinch of Rubia Cordifolia...",
  "Almost there — great things take time (and turmeric)...",
  "Our AI artist is channelling Madhubani energy...",
  "Warming up the creative mortar and pestle...",
  "Infusing your ad with a little ancient magic...",
  "Patience is an Ayurvedic virtue — almost done...",
  "Your images are being hand-crafted by algorithms with taste...",
  "Fun fact: it takes 72 hours to cook Balaayah oil. This is faster.",
  "Calibrating visual regal-ness to 100%...",
  "If this were a Chyawanprash, we'd be on the 47th herb...",
  "Asking the AI to add more oomph...",
  "Brewing creativity — no preservatives added...",
  "Making sure every pixel is Dosha-balanced...",
  "The AI is doing its Surya Namaskar before painting...",
  "Aligning chakras of colour and composition...",
  "One does not simply rush great Ayurvedic art...",
  "Distilling centuries of wisdom into one ad...",
  "Sprinkling a dash of Ashwagandha energy...",
  "Teaching the neural network about Panchakarma aesthetics...",
];

export function getRandomMessage(exclude?: string): string {
  const available = exclude
    ? loadingMessages.filter((m) => m !== exclude)
    : loadingMessages;
  return available[Math.floor(Math.random() * available.length)];
}
