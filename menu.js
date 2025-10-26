document.addEventListener('DOMContentLoaded', () => {
    const teamSnow = document.getElementById('team-snow');
    const teamAsh = document.getElementById('team-ash');
    const playHumanBtn = document.getElementById('play-human-btn');
    const playAiBtn = document.getElementById('play-ai-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const notesBtn = document.getElementById('notes-btn');
    let selectedTeam = null;

    const enableStartButtons = () => {
        playHumanBtn.disabled = false;
        playAiBtn.disabled = false;
    };

    teamSnow.addEventListener('click', () => {
        selectedTeam = 'snow';
        teamSnow.classList.add('selected');
        teamAsh.classList.remove('selected');
        enableStartButtons();
    });

    teamAsh.addEventListener('click', () => {
        selectedTeam = 'ash';
        teamAsh.classList.add('selected');
        teamSnow.classList.remove('selected');
        enableStartButtons();
    });

    playHumanBtn.addEventListener('click', () => {
        if (selectedTeam) window.location.href = `game.html?team=${selectedTeam}&mode=human`;
    });

    playAiBtn.addEventListener('click', () => {
        if (selectedTeam) window.location.href = `game.html?team=${selectedTeam}&mode=ai`;
    });

    rulesBtn.addEventListener('click', () => window.location.href = 'rules.html');
    notesBtn.addEventListener('click', () => window.location.href = 'notes.html');
});