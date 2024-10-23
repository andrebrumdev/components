import { Command } from "commander";
import path from "node:path";
import { existsSync, promises as fs } from "node:fs";
import { z } from "zod";
import ora from "ora";
import prompts from "prompts";
import axios from "axios";
import AdmZip from "adm-zip"; // Para manipular arquivos ZIP

export const addOptionsSchema = z.object({
  components: z.array(z.string()).optional(),
  yes: z.boolean(),
  overwrite: z.boolean(),
  cwd: z.string(),
  all: z.boolean(),
  path: z.string().optional(),
  silent: z.boolean(),
  srcDir: z.boolean().optional(),
});

export const add = new Command()
  .name("add")
  .description("Adiciona um componente ao seu projeto")
  .argument(
    "[components...]",
    "os componentes a serem adicionados ou uma URL para o componente."
  )
  .option("-y, --yes", "pular o prompt de confirmação.", false)
  .option("-o, --overwrite", "sobrescrever arquivos existentes.", false)
  .option(
    "-c, --cwd <cwd>",
    "o diretório de trabalho. padrão é o diretório atual.",
    process.cwd()
  )
  .option("-a, --all", "adicionar todos os componentes disponíveis", false)
  .option("-p, --path <path>", "o caminho para adicionar o componente.")
  .option("-s, --silent", "silenciar a saída.", false)
  .option("--src-dir", "usar o diretório src ao criar um novo projeto.", false)
  .action(async (components, opts) => {
    try {
      const options = addOptionsSchema.parse({
        components,
        cwd: path.resolve(opts.cwd),
        ...opts,
      });

      const spinner = ora("Baixando e extraindo componentes...").start();

      // Função que faz o download do ZIP e retorna a instância do AdmZip
      const zip = await downloadAndExtractFolder(
        "https://github.com/andrebrumdev/components/archive/refs/heads/main.zip"
      ); // Ajuste o URL conforme necessário

      spinner.succeed("Componentes baixados e extraídos com sucesso.");

      // Listar diretórios disponíveis no ZIP
      const availableDirs = getAvailableDirectoriesFromZip(zip);

      if (availableDirs.length === 0) {
        console.log("Nenhuma pasta disponível para copiar.");
        return;
      }

      // Exibe a seleção interativa de pastas no ZIP
      const { selectedDir } = await prompts({
        type: "select",
        name: "selectedDir",
        message: "Qual pasta você gostaria de copiar?",
        choices: availableDirs.map((dir) => ({ title: dir, value: dir })),
      });

      if (!selectedDir) {
        console.log("Nenhuma pasta selecionada.");
        return;
      }

      // Se o usuário não forneceu componentes, exibir prompt para selecionar
      if (!components.length) {
        const availableComponents = getAvailableComponentsFromZip(
          zip,
          selectedDir
        );

        const { components: selectedComponents } = await prompts({
          type: "multiselect",
          name: "components",
          message: "Quais componentes você gostaria de adicionar?",
          hint: "Espaço para selecionar. A para selecionar todos. Enter para enviar.",
          instructions: false,
          choices: availableComponents.map((component) => ({
            title: component,
            value: component,
            selected: options.all,
          })),
        });

        components = selectedComponents;
      }

      if (!components.length && !options.all) {
        console.log("Nenhum componente foi selecionado.");
        return;
      }

      // Copiar os componentes selecionados do ZIP para o diretório de destino
      await copyComponentsFromZip(zip, selectedDir, components, options);
    } catch (error) {
      console.error("Erro ao copiar componentes:", error);
    }
  });

// Função para baixar e extrair um ZIP
export async function downloadAndExtractFolder(url: string): Promise<AdmZip> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer", // Receber os dados como array de bytes
    });

    // Criar uma instância do AdmZip com os dados recebidos
    const zip = new AdmZip(response.data);
    return zip;
  } catch (error) {
    console.error("Erro ao baixar o arquivo ZIP:", error);
    throw error;
  }
}

// Função para listar as subpastas disponíveis no arquivo ZIP
function getAvailableDirectoriesFromZip(zip: AdmZip): string[] {
  const directories = new Set<string>();
  zip.getEntries().forEach((entry) => {
    const dirName = entry.entryName.split("/")[0];
    if (entry.isDirectory && !directories.has(dirName)) {
      directories.add(dirName);
    }
  });
  return Array.from(directories);
}

// Função para listar componentes disponíveis em uma subpasta específica no ZIP
function getAvailableComponentsFromZip(
  zip: AdmZip,
  selectedDir: string
): string[] {
  const components = new Set<string>();
  zip.getEntries().forEach((entry) => {
    if (entry.entryName.startsWith(`${selectedDir}/`) && !entry.isDirectory) {
      const component = entry.entryName
        .replace(`${selectedDir}/`, "")
        .split("/")[0];
      components.add(component);
    }
  });
  return Array.from(components);
}

// Função para copiar componentes selecionados do ZIP para o diretório de destino
async function copyComponentsFromZip(
  zip: AdmZip,
  selectedDir: string,
  components: string[],
  { cwd: destDir, overwrite }: z.infer<typeof addOptionsSchema>
): Promise<void> {
  const spinner = ora("Copiando componentes selecionados...").start();

  for (const component of components) {
    const zipEntries = zip
      .getEntries()
      .filter((entry) =>
        entry.entryName.startsWith(`${selectedDir}/${component}/`)
      );

    for (const entry of zipEntries) {
      const relativePath = entry.entryName.replace(`${selectedDir}/`, "");
      const destPath = path.join(destDir, relativePath);

      // Verifica se é uma pasta ou arquivo
      if (entry.isDirectory) {
        if (!existsSync(destPath)) {
          await fs.mkdir(destPath, { recursive: true });
        }
      } else {
        if (existsSync(destPath) && !overwrite) {
          console.log(`Arquivo ${relativePath} já existe. Pulando...`);
          continue;
        }
        await fs.writeFile(destPath, entry.getData());
        console.log(`Arquivo ${relativePath} copiado para ${destDir}.`);
      }
    }
  }

  spinner.succeed("Componentes copiados com sucesso.");
}
