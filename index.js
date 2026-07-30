require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");

const stations = require("./config/stations");
const player = require("./music/player");
const { playRadio, getCurrentStation } = require("./music/radio");
const { handleVoiceWelcome } = require("./events/voiceWelcome");
const { handleCameraReminder } = require("./events/cameraReminder");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let connection;

const commands = [
    new SlashCommandBuilder()
        .setName("radio")
        .setDescription("Abre o menu de rádios de estudo."),

    new SlashCommandBuilder()
        .setName("status")
        .setDescription("Mostra qual rádio está tocando.")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
    console.log("🔧 Registrando comandos...");

    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
        ),
        { body: commands }
    );

    console.log("✅ Comandos registrados com sucesso.");
}

async function connectToVoice() {
    const channel = await client.channels.fetch(
        process.env.VOICE_CHANNEL_ID
    );

    if (!channel) {
        console.log("❌ Canal de voz não encontrado.");
        return;
    }

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
    });

    connection.subscribe(player);

    console.log(`🎧 Entrei na sala: ${channel.name}`);
}

client.once("clientReady", async () => {
    try {
        console.log(`✅ ${client.user.tag} está online!`);

        await registerCommands();
        await connectToVoice();
        await playRadio(stations.lofi);

    } catch (error) {
        console.error("❌ Erro ao iniciar o bot:");
        console.error(error);
    }
});

client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === "radio") {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId("radio_select")
                    .setPlaceholder("Escolha uma rádio de estudos")
                    .addOptions(
                        Object.entries(stations).map(
                            ([key, station]) => ({
                                label: station.label,
                                description: station.description,
                                value: key
                            })
                        )
                    );

                const row = new ActionRowBuilder()
                    .addComponents(menu);

                await interaction.reply({
                    content:
                        "📻 **Rádio GTE**\n" +
                        "Escolha a estação para estudar:",
                    components: [row],
                    ephemeral: true
                });

                return;
            }

            if (interaction.commandName === "status") {
                const current = getCurrentStation();

                await interaction.reply(
                    current
                        ? `📡 Tocando agora: **${current.name}**.`
                        : "📡 Nenhuma rádio está tocando no momento."
                );

                return;
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "radio_select") {
                const selectedKey = interaction.values[0];
                const selectedStation = stations[selectedKey];

                if (!selectedStation) {
                    await interaction.reply({
                        content: "❌ Rádio não encontrada.",
                        ephemeral: true
                    });

                    return;
                }

                await playRadio(selectedStation);

                await interaction.update({
                    content:
                        "📻 **Rádio GTE**\n" +
                        `Estação alterada para **${selectedStation.name}**.\n` +
                        "Bons estudos! 🚔📚",
                    components: []
                });
            }
        }
    } catch (error) {
        console.error("❌ Erro ao processar interação:");
        console.error(error);
    }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
        await handleVoiceWelcome(oldState, newState);
    } catch (error) {
        console.error("❌ Erro no evento de boas-vindas:");
        console.error(error);
    }

    try {
        await handleCameraReminder(oldState, newState);
    } catch (error) {
        console.error("❌ Erro no aviso de câmera:");
        console.error(error);
    }
});

client.login(process.env.TOKEN);