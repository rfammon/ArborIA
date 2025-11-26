import { GoogleGenerativeAI } from "@google/generative-ai";
import readline from "readline";

// ATEN��O: Sub
// stitua ISSO_AQUI pela sua chave API real
const API_KEY = "";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- Gemini no Terminal (ArborIA) ---");

function ask() {
  rl.question("Voc�: ", async (msg) => {
    if (msg.toLowerCase() === "sair") { rl.close(); return; }
    try {
      const result = await model.generateContent(msg);
      console.log("\nGemini:", result.response.text(), "\n");
    } catch (e) { console.log("Erro:", e.message); }
    ask();
  });
}
ask();
