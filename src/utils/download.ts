import axios from "axios";
import AdmZip from "adm-zip";

// Função para baixar e extrair um zip de uma pasta específica no GitHub
export async function downloadAndExtractFolder(url: string): Promise<AdmZip> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });
    const zip = new AdmZip(response.data);
    return zip;
  } catch (error) {
    console.error("Erro ao baixar o arquivo ZIP:", error);
    throw error;
  }
}
