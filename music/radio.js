const {
    createAudioResource,
    StreamType,
    AudioPlayerStatus
} = require("@discordjs/voice");

const player = require("./player");

let currentStation = null;

async function playRadio(station) {
    currentStation = station;

    const resource = createAudioResource(station.url, {
        inputType: StreamType.Arbitrary
    });

    player.play(resource);

    console.log(`📻 Tocando agora: ${station.name}`);
}

function getCurrentStation() {
    return currentStation;
}

player.on(AudioPlayerStatus.Idle, () => {
    if (!currentStation) return;

    console.log("⚠️ Rádio parou. Tentando reconectar em 5 segundos...");

    setTimeout(() => {
        playRadio(currentStation);
    }, 5000);
});

player.on("error", (error) => {
    console.log("❌ Erro no player:");
    console.log(error.message);

    if (!currentStation) return;

    console.log("🔄 Tentando reconectar em 5 segundos...");

    setTimeout(() => {
        playRadio(currentStation);
    }, 5000);
});

module.exports = {
    playRadio,
    getCurrentStation
};