import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeWasteImage = async (base64Image: string, description: string): Promise<AnalysisResult> => {
  try {
    // Strip the data URL prefix if present to get raw base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: cleanBase64
                }
            },
            {
                text: `Analyze this image for a smart waste management system. The user describes it as: "${description}".
                
                Perform a deep visual analysis to determine:
                1. Is this strictly waste/garbage? (Boolean)
                2. Severity Level (Low/Medium/High/Critical) based on health hazard and size.
                3. Primary Waste Type (e.g., "Domestic", "Industrial", "Construction", "Hazardous").
                4. Identify specific MATERIALS present (e.g., ["Single-use Plastic", "Organic Food", "Cardboard", "Metal Cans"]). Be specific about plastics.
                5. Is the majority of this waste recyclable? (Boolean)
                6. Estimate the quantity/size (e.g., "Small bag (<2kg)", "Pile (5-10kg)", "Large Dump (>50kg)").
                7. Provide a specific Cleanup Recommendation (e.g., "Requires gloves and separate plastic recycling bag", "Needs heavy machinery").
                8. A brief 1-sentence summary.`
            }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isWaste: { type: Type.BOOLEAN },
            severity: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
            wasteType: { type: Type.STRING },
            summary: { type: Type.STRING },
            materials: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of identified materials like Plastic, Glass, etc."
            },
            isRecyclable: { type: Type.BOOLEAN },
            estimatedQuantity: { type: Type.STRING },
            cleanupRecommendation: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER, description: "Confidence score between 0 and 1" }
          },
          required: ["isWaste", "severity", "wasteType", "summary", "materials", "isRecyclable", "estimatedQuantity", "cleanupRecommendation"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback if AI fails
    return {
      isWaste: true,
      severity: "Medium",
      wasteType: "Unidentified",
      summary: "AI analysis failed, report submitted for manual review.",
      materials: ["Unknown"],
      isRecyclable: false,
      estimatedQuantity: "Unknown",
      cleanupRecommendation: "Standard cleanup required",
      confidenceScore: 0
    };
  }
};