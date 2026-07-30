const { PermissionFlagsBits } = require("discord.js");

const timers = new Map();

const CAMERA_GRACE_PERIOD = 30_000; // 30 segundos

/**
 * Cancela o cronômetro existente de um membro.
 */
function clearMemberTimer(memberId) {
    const existingTimer = timers.get(memberId);

    if (!existingTimer) {
        return;
    }

    clearTimeout(existingTimer);
    timers.delete(memberId);
}

/**
 * Envia o aviso por mensagem privada.
 */
async function sendCameraWarning(member) {
    const message =
        "📷 **Sua câmera está desligada.**\n\n" +
        "Esta sala é destinada aos participantes que desejam estudar " +
        "com a câmera aberta e o microfone fechado.\n\n" +
        "Você tem **30 segundos** para ligar a câmera. " +
        "Caso contrário, será desconectado automaticamente da sala.";

    try {
        await member.send(message);

        console.log(
            `📨 Aviso privado enviado para ${member.user.tag}.`
        );
    } catch (error) {
        console.log(
            `⚠️ Não foi possível enviar mensagem privada para ${member.user.tag}.`
        );
    }

    /*
     * Envia também no canal configurado, caso exista.
     * O aviso no canal não interfere na desconexão.
     */
    const warningChannelId =
        process.env.CAMERA_WARNING_CHANNEL_ID;

    if (!warningChannelId) {
        return;
    }

    try {
        const warningChannel =
            await member.guild.channels.fetch(warningChannelId);

        if (!warningChannel || !warningChannel.isTextBased()) {
            console.log(
                "⚠️ CAMERA_WARNING_CHANNEL_ID não corresponde a um canal de texto."
            );
            return;
        }

        await warningChannel.send(
            `📷 ${member}, sua câmera está desligada.\n` +
            "Você tem **30 segundos** para ligá-la antes de ser desconectado da sala."
        );
    } catch (error) {
        console.log(
            "⚠️ Não foi possível enviar o aviso no canal configurado."
        );
    }
}

/**
 * Mostra no terminal as permissões efetivas do bot.
 */
function showPermissionDiagnosis(member) {
    const guild = member.guild;
    const botMember = guild.members.me;
    const voiceChannel = member.voice.channel;

    if (!botMember) {
        console.log("❌ Não foi possível localizar o bot no servidor.");
        return;
    }

    const serverMovePermission =
        botMember.permissions.has(
            PermissionFlagsBits.MoveMembers
        );

    const channelPermissions = voiceChannel
        ? voiceChannel.permissionsFor(botMember)
        : null;

    const channelMovePermission =
        channelPermissions
            ? channelPermissions.has(
                PermissionFlagsBits.MoveMembers
            )
            : false;

    console.log("========== DIAGNÓSTICO DA CÂMERA ==========");
    console.log("Usuário:", member.user.tag);
    console.log("ID do usuário:", member.id);

    console.log(
        "Canal atual:",
        voiceChannel
            ? `${voiceChannel.name} (${voiceChannel.id})`
            : "Nenhum"
    );

    console.log(
        "Cargo mais alto do usuário:",
        member.roles.highest.name,
        "| posição:",
        member.roles.highest.position
    );

    console.log(
        "Cargo mais alto do bot:",
        botMember.roles.highest.name,
        "| posição:",
        botMember.roles.highest.position
    );

    console.log(
        "Mover membros no servidor:",
        serverMovePermission
    );

    console.log(
        "Mover membros na sala:",
        channelMovePermission
    );

    console.log(
        "Usuário é dono do servidor:",
        guild.ownerId === member.id
    );

    console.log(
        "VoiceState disconnectable:",
        member.voice.disconnectable
    );

    console.log("===========================================");
}

/**
 * Programa a desconexão após os 30 segundos.
 */
async function scheduleDisconnect(member, cameraChannelId) {
    clearMemberTimer(member.id);

    const timer = setTimeout(async () => {
        timers.delete(member.id);

        try {
            /*
             * Busca novamente o membro para não trabalhar
             * com informações antigas.
             */
            const updatedMember =
                await member.guild.members.fetch(member.id);

            const currentVoiceState =
                updatedMember.voice;

            const isStillInCameraRoom =
                currentVoiceState.channelId ===
                cameraChannelId;

            const cameraIsStillOff =
                currentVoiceState.selfVideo !== true;

            if (!isStillInCameraRoom) {
                console.log(
                    `ℹ️ ${updatedMember.user.tag} saiu ou mudou de sala.`
                );
                return;
            }

            if (!cameraIsStillOff) {
                console.log(
                    `✅ ${updatedMember.user.tag} ligou a câmera dentro do prazo.`
                );
                return;
            }

            showPermissionDiagnosis(updatedMember);

            /*
             * Verifica se o bot possui a permissão efetiva
             * dentro da sala de voz.
             */
            const botMember =
                updatedMember.guild.members.me;

            const voiceChannel =
                updatedMember.voice.channel;

            if (!botMember || !voiceChannel) {
                console.log(
                    "❌ Não foi possível localizar o bot ou a sala de voz."
                );
                return;
            }

            const botPermissions =
                voiceChannel.permissionsFor(botMember);

            const canMoveMembers =
                botPermissions?.has(
                    PermissionFlagsBits.MoveMembers
                );

            if (!canMoveMembers) {
                console.log(
                    `❌ O bot não possui a permissão efetiva "Mover membros" na sala ${voiceChannel.name}.`
                );
                return;
            }

            /*
             * O dono do servidor não pode ser desconectado pelo bot.
             */
            if (
                updatedMember.guild.ownerId ===
                updatedMember.id
            ) {
                console.log(
                    `❌ ${updatedMember.user.tag} é o proprietário do servidor.`
                );
                return;
            }

            /*
             * Tenta desconectar.
             * Caso o Discord recuse, o erro completo será exibido.
             */
            await updatedMember.voice.disconnect(
                "Câmera permaneceu desligada na sala de câmera aberta."
            );

            console.log(
                `🚫 ${updatedMember.user.tag} foi desconectado por permanecer com a câmera desligada.`
            );
        } catch (error) {
            console.error(
                `❌ Erro ao desconectar ${member.user.tag}:`
            );

            console.error(error);

            if (error?.code === 50013) {
                console.error(
                    "🚨 DiscordAPIError[50013]: faltam permissões efetivas ou existe bloqueio de hierarquia."
                );
            }
        }
    }, CAMERA_GRACE_PERIOD);

    timers.set(member.id, timer);
}

/**
 * Trata entradas, saídas e alterações da câmera.
 */
async function handleCameraReminder(
    oldState,
    newState
) {
    const cameraChannelId =
        process.env.CAMERA_CHANNEL_ID;

    if (!cameraChannelId) {
        console.log(
            "❌ CAMERA_CHANNEL_ID não foi configurado no arquivo .env."
        );
        return;
    }

    const member =
        newState.member || oldState.member;

    if (!member || member.user.bot) {
        return;
    }

    const wasInCameraRoom =
        oldState.channelId === cameraChannelId;

    const isInCameraRoom =
        newState.channelId === cameraChannelId;

    const cameraWasOn =
        oldState.selfVideo === true;

    const cameraIsOn =
        newState.selfVideo === true;

    /*
     * Saiu da sala ou mudou de canal.
     */
    if (wasInCameraRoom && !isInCameraRoom) {
        clearMemberTimer(member.id);

        console.log(
            `ℹ️ ${member.user.tag} saiu da sala de câmera aberta.`
        );

        return;
    }

    /*
     * Alteração realizada fora da sala monitorada.
     */
    if (!isInCameraRoom) {
        return;
    }

    /*
     * Ligou a câmera.
     */
    if (cameraIsOn) {
        clearMemberTimer(member.id);

        if (!cameraWasOn) {
            console.log(
                `✅ ${member.user.tag} ligou a câmera.`
            );
        }

        return;
    }

    const enteredCameraRoom =
        !wasInCameraRoom && isInCameraRoom;

    const turnedCameraOff =
        wasInCameraRoom &&
        cameraWasOn &&
        !cameraIsOn;

    /*
     * Entrou com câmera desligada
     * ou desligou depois de entrar.
     */
    if (enteredCameraRoom || turnedCameraOff) {
        if (enteredCameraRoom) {
            console.log(
                `📷 ${member.user.tag} entrou na sala com a câmera desligada.`
            );
        }

        if (turnedCameraOff) {
            console.log(
                `📷 ${member.user.tag} desligou a câmera dentro da sala.`
            );
        }

        await sendCameraWarning(member);

        await scheduleDisconnect(
            member,
            cameraChannelId
        );
    }
}

module.exports = {
    handleCameraReminder
};