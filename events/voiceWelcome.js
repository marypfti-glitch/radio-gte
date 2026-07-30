const missoes = [
    "🎯 Resolva 10 questões antes de sair da sala.",
    "📌 Revise 3 erros antigos do seu caderno de erros.",
    "⏱️ Faça 25 minutos de foco total, sem trocar de aba.",
    "📚 Estude um tópico curto e depois faça 5 questões.",
    "🚔 Anote uma dúvida e leve para o grupo depois.",
    "🧠 Refaça uma questão que você errou essa semana.",
];

async function handleVoiceWelcome(oldState, newState) {
    if (newState.member.user.bot) return;

    const entrouOuMudouDeSala =
        newState.channelId && oldState.channelId !== newState.channelId;

    if (!entrouOuMudouDeSala) return;

    try {
        const usuario = newState.member.user;
        const missao = missoes[Math.floor(Math.random() * missoes.length)];

        await usuario.send(
`🛡️ **Mentor GTE**

📚 Bons estudos, **${newState.member.displayName}**!

${missao}

**Regra operacional:** entrou na sala, execute uma missão pequena. Constância vence ansiedade.`
        );

        console.log(`📩 Mensagem privada enviada para ${newState.member.displayName}`);

    } catch (erro) {
        console.log(`⚠️ Não consegui enviar DM para ${newState.member.displayName}.`);
    }
}

module.exports = {
    handleVoiceWelcome,
};