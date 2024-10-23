import { Command } from "commander";
import path from "node:path";
import { existsSync, promises as fs } from "node:fs"; // Usar fs para ler diretórios e arquivos
import { z } from "zod";
import ora from "ora";
import prompts from "prompts"; // Importa prompts para interatividade
import { downloadAndExtractFolder } from "../utils/download";

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
      const baseDir = path.resolve("src/components"); // Diretório base onde as subpastas são buscadas (src)
      const availableDirs = await getAvailableDirectories(baseDir); // Obtém as subpastas

      if (availableDirs.length === 0) {
        console.log("Nenhuma pasta disponível para copiar.");
        return;
      }

      // Exibe a seleção interativa de pastas
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
      const srcDir = path.join(baseDir, selectedDir); // Diretório da pasta selecionada
      if (!components.length) {
        const availableComponents = await getAvailableDirectories(srcDir); // Obtenha os componentes disponíveis

        // Exibir a seleção interativa com prompts
        const { components: selectedComponents } = await prompts({
          type: "multiselect",
          name: "components",
          message: "Quais componentes você gostaria de adicionar?",
          hint: "Espaço para selecionar. A para selecionar todos. Enter para enviar.",
          instructions: false,
          choices: availableComponents.map((component) => ({
            title: component, // Exibe o nome do componente na interface
            value: component, // Valor selecionado
            selected: options.all, // Marca todos os componentes se --all for passado
          })),
        });

        // Atualizar os componentes selecionados
        components = selectedComponents;
      }

      if (!components.length && !options.all) {
        console.log("Nenhum componente foi selecionado.");
      }

      // Copiar os componentes
      await copyComponents(srcDir, components, options);
    } catch (error) {
      console.error("Erro ao copiar componentes:", error);
    }
  });

// Função para obter os componentes disponíveis no diretório de origem
async function getAvailableComponents() {
  const componentsDir = path.resolve("src/ui"); // Ajuste conforme a origem real dos componentes
  try {
    const files = await fs.readdir(componentsDir);
    return files.filter((file) => !file.includes(".")); // Retorna apenas diretórios (outra lógica pode ser aplicada conforme a necessidade)
  } catch (error) {
    console.error("Erro ao listar componentes:", error);
    return [];
  }
}

// Função para copiar os componentes selecionados
async function copyComponents(
  componentsDir: string,
  components: any,
  { overwrite, cwd: destDir }: z.infer<typeof addOptionsSchema>
) {
  const availableComponents = await getAvailableComponents();
  const spinner = ora("Copiando componentes...").start();

  // Copia os componentes especificados
  for (const component of components) {
    if (!availableComponents.includes(component)) {
      console.log(`Componente ${component} não está disponível.`);
      continue;
    }

    const srcComponentDir = path.join(componentsDir, component);
    const destComponentDir = path.join(destDir, component);

    try {
      // Copia a pasta inteira
      await downloadAndExtractFolder(
        srcComponentDir,
        destComponentDir,
        overwrite
      );
      console.log(`Componente ${component} copiado para ${destDir}.`);
    } catch (error) {
      console.error(`Erro ao copiar ${component}:`, error);
    }
  }

  spinner.succeed("Todos os componentes foram copiados.");
}

async function getAvailableDirectories(baseDir: string) {
  const directories = [];
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories.push(entry.name); // Adiciona a subpasta como uma opção
      }
    }
  } catch (error) {
    console.error(`Erro ao ler o diretório ${baseDir}:`, error);
  }
  return directories;
}
