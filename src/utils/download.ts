import path from "node:path";
import { existsSync, promises as fs } from "node:fs"; // Usar fs para ler diretórios e manipular arquivos
import axios from "axios";
import AdmZip from "adm-zip";

// Função para baixar e extrair um zip de uma pasta específica no GitHub
export async function downloadAndExtractFolder(
  folder: string,
  destDir: string,
  overwrite = false,
  owner: string = "andrebrumdev",
  repo: string = "components",
  branch: string = "main"
) {
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
  const response = await axios.get(zipUrl, { responseType: "arraybuffer" });
  const zip = new AdmZip(response.data);

  // Filtrar os arquivos que estão dentro da pasta específica
  const zipEntries = zip
    .getEntries()
    .filter((entry) =>
      entry.entryName.startsWith(`${repo}-${branch}/${folder}/`)
    );

  if (!existsSync(destDir)) {
    await fs.mkdir(destDir, { recursive: true });
  }

  for (const entry of zipEntries) {
    const relativePath = entry.entryName.replace(
      `${repo}-${branch}/${folder}/`,
      ""
    );
    const destPath = path.join(destDir, relativePath);
    if (entry.isDirectory) {
      if (!existsSync(destPath)) {
        await fs.mkdir(destPath, { recursive: true });
      }
    } else {
      if (existsSync(destPath) && !overwrite) {
        console.log(
          `Arquivo ${relativePath} já existe em ${destDir}. Pulando...`
        );
        continue;
      }
      await fs.writeFile(destPath, entry.getData());
      console.log(`Arquivo ${relativePath} copiado para ${destDir}.`);
    }
  }
}
