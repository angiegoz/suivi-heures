
// ==========================================
// 1. CONFIGURATION ET DONNÉES
// ==========================================

const STORAGE_KEY = "suivi-heures-v1";

const initialDays = [];

let settings = {
    weeklyTarget: 39,
    defaultBreak: 60
};

let days = loadData();

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const data = JSON.parse(saved);
            settings = data.settings || settings;
            return data.days || initialDays;
        }
    } catch (error) {
        console.error("Erreur de lecture des données :", error);
    }

    return [...initialDays];
}

function saveData() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ days, settings })
    );
}

// ==========================================
// 2. OUTILS DE CALCUL
// ==========================================

function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function formatDuration(minutes) {
    const sign = minutes < 0 ? "-" : "";
    const absolute = Math.abs(Math.round(minutes));

    const hours = Math.floor(absolute / 60);
    const mins = absolute % 60;

    return `${sign}${hours}h${String(mins).padStart(2, "0")}`;
}

function getWorkedMinutes(day) {
    if (!day.arrival || !day.departure) return 0;

    let duration =
        timeToMinutes(day.departure) -
        timeToMinutes(day.arrival);

    // Permet aussi de gérer un départ après minuit.
    if (duration < 0) duration += 24 * 60;

    return Math.max(0, duration - Number(day.breakMinutes || 0));
}

function formatDate(dateString) {
    return new Date(dateString + "T12:00:00").toLocaleDateString(
        "fr-FR",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}

function getMonday(date) {
    const result = new Date(date);
    result.setHours(12, 0, 0, 0);

    const day = result.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + difference);
    return result;
}

function dateToString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ==========================================
// 3. ACCUEIL
// ==========================================

function updateHome() {
    const today = new Date();
    const monday = getMonday(today);

    const mondayString = dateToString(monday);

    const weekDays = days.filter(day => {
        const date = new Date(day.date + "T12:00:00");
        const diff = (date - monday) / (1000 * 60 * 60 * 24);

        return diff >= 0 && diff < 5;
    });

    const weeklyMinutes = weekDays.reduce(
        (total, day) => total + getWorkedMinutes(day), 0
    );

    const weeklyTarget = settings.weeklyTarget * 60;
    const balance = weeklyMinutes - weeklyTarget;

    document.getElementById("weekly-total").textContent =
        formatDuration(weeklyMinutes);

    document.getElementById("weekly-progress").style.width =
        Math.min(100, weeklyMinutes / weeklyTarget * 100) + "%";

    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 4);

    document.getElementById("weekly-balance").textContent =
        balance >= 0
            ? `Objectif atteint : +${formatDuration(balance)}`
            : `Il reste ${formatDuration(-balance)} pour atteindre l'objectif`;

    const totalMinutes = days.reduce(
        (total, day) => total + getWorkedMinutes(day), 0
    );

    const average = days.length ? totalMinutes / days.length : 0;

    document.getElementById("total-hours").textContent =
        formatDuration(totalMinutes);

    document.getElementById("daily-average").textContent =
        formatDuration(average);

    document.getElementById("days-count").textContent = days.length;

    // Heures supplémentaires des semaines complètes
    const overtime = calculateOvertime();

    document.getElementById("overtime").textContent =
        formatDuration(overtime);

    updateAlerts(weekDays);
}

// ==========================================
// 4. HEURES SUPPLÉMENTAIRES
// ==========================================

function calculateOvertime() {
    const weeks = {};

    days.forEach(day => {
        const monday = getMonday(new Date(day.date + "T12:00:00"));
        const key = dateToString(monday);

        if (!weeks[key]) weeks[key] = [];

        weeks[key].push(day);
    });

    let totalOvertime = 0;

    Object.entries(weeks).forEach(([mondayString, weekDays]) => {
        const monday = new Date(mondayString + "T12:00:00");

        // Une semaine est complète si les cinq jours ouvrés
        // sont renseignés.
        const weekdaysPresent = new Set(
            weekDays.map(day => new Date(day.date + "T12:00:00").getDay())
        );

        if ([1, 2, 3, 4, 5].every(day => weekdaysPresent.has(day))) {
            const total = weekDays.reduce(
                (sum, day) => sum + getWorkedMinutes(day), 0
            );

            totalOvertime += Math.max(
                0,
                total - settings.weeklyTarget * 60
            );
        }
    });

    return totalOvertime;
}

// ==========================================
// 5. ALERTES
// ==========================================

function updateAlerts(weekDays) {
    const alerts = document.getElementById("alerts");
    alerts.innerHTML = "";

    const shortDays = days.filter(
        day => getWorkedMinutes(day) < 468
    );

    if (shortDays.length === 0) {
        alerts.innerHTML =
            '<p class="muted">Aucune journée sous les 7h48.</p>';
        return;
    }

    shortDays.forEach(day => {
        const item = document.createElement("p");
        item.textContent =
            `${formatDate(day.date)} : ${formatDuration(getWorkedMinutes(day))}`;
        item.style.marginBottom = "10px";
        item.style.fontSize = "13px";

        alerts.appendChild(item);
    });
}

// ==========================================
// 6. HISTORIQUE
// ==========================================

function updateHistory() {
    const list = document.getElementById("history-list");
    list.innerHTML = "";

    const sortedDays = [...days].sort(
        (a, b) => b.date.localeCompare(a.date)
    );

    sortedDays.forEach(day => {
        const card = document.createElement("div");
        card.className = "day-card";

        const title = document.createElement("h3");
        title.textContent = formatDate(day.date);

        const duration = document.createElement("p");
        duration.textContent =
            "Temps travaillé : " + formatDuration(getWorkedMinutes(day));

        const arrival = document.createElement("p");
        arrival.textContent = "Arrivée : " + day.arrival;

        const departure = document.createElement("p");
        departure.textContent = "Départ : " + day.departure;

        const breakInfo = document.createElement("p");
        breakInfo.textContent =
            `Pause : ${formatDuration(day.breakMinutes)}`;

        const editButton = document.createElement("button");
        editButton.className = "primary-button";
        editButton.textContent = "Modifier cette journée";

        editButton.addEventListener("click", () => editDay(day.date));

        card.append(title, duration, arrival, departure, breakInfo, editButton);
        list.appendChild(card);
    });

    if (days.length === 0) {
        list.innerHTML = '<p class="muted">Aucune journée enregistrée.</p>';
    }
}

// ==========================================
// 7. MODIFICATION D'UNE JOURNÉE
// ==========================================

function editDay(date) {
    const day = days.find(item => item.date === date);
    if (!day) return;

    const arrival = prompt("Heure d'arrivée (HH:MM)", day.arrival);
    if (arrival === null) return;

    const departure = prompt("Heure de départ (HH:MM)", day.departure);
    if (departure === null) return;

    const hours = Math.floor(day.breakMinutes / 60);
    const minutes = day.breakMinutes % 60;

    const breakHours = prompt("Heures de pause", hours);
    if (breakHours === null) return;

    const breakMinutes = prompt("Minutes de pause", minutes);
    if (breakMinutes === null) return;

    if (
        !/^\d{2}:\d{2}$/.test(arrival) ||
        !/^\d{2}:\d{2}$/.test(departure) ||
        !Number.isInteger(Number(breakHours)) ||
        !Number.isInteger(Number(breakMinutes)) ||
        Number(breakHours) < 0 ||
        Number(breakMinutes) < 0 ||
        Number(breakMinutes) > 59 ||
        timeToMinutes(arrival) >= 1440 ||
        timeToMinutes(departure) >= 1440
    ) {
        alert("Les valeurs saisies ne sont pas valides.");
        return;
    }

    day.arrival = arrival;
    day.departure = departure;
    day.breakMinutes =
        Number(breakHours) * 60 + Number(breakMinutes);

    saveData();
    refreshApp();
}

// ==========================================
// 8. AJOUT D'UNE JOURNÉE
// ==========================================

function addDay() {
    const date = prompt("Date (AAAA-MM-JJ)", dateToString(new Date()));
    if (!date) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Format de date invalide.");
        return;
    }

    if (days.some(day => day.date === date)) {
        alert("Cette journée existe déjà.");
        return;
    }

    const arrival = prompt("Heure d'arrivée (HH:MM)", "09:00");
    if (!arrival) return;

    const departure = prompt("Heure de départ (HH:MM)", "18:00");
    if (!departure) return;

    if (
        !/^\d{2}:\d{2}$/.test(arrival) ||
        !/^\d{2}:\d{2}$/.test(departure) ||
        timeToMinutes(arrival) >= 1440 ||
        timeToMinutes(departure) >= 1440
    ) {
        alert("Les horaires ne sont pas valides.");
        return;
    }

    days.push({
        date,
        arrival,
        departure,
        breakMinutes: settings.defaultBreak
    });

    saveData();
    refreshApp();
}

// ==========================================
// 9. STATISTIQUES
// ==========================================

function updateStatistics() {
    const values = days.map(getWorkedMinutes).sort((a, b) => a - b);

    if (values.length === 0) return;

    const middle = Math.floor(values.length / 2);

    const median = values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2;

    document.getElementById("median-hours").textContent =
        formatDuration(median);

    const longest = [...days].sort(
        (a, b) => getWorkedMinutes(b) - getWorkedMinutes(a)
    )[0];

    const shortest = [...days].sort(
        (a, b) => getWorkedMinutes(a) - getWorkedMinutes(b)
    )[0];

    document.getElementById("longest-day").textContent =
        formatDuration(getWorkedMinutes(longest));

    document.getElementById("shortest-day").textContent =
        formatDuration(getWorkedMinutes(shortest));
}

// ==========================================
// 10. RÉGLAGES
// ==========================================

function loadSettings() {
    document.getElementById("weekly-target").value =
        settings.weeklyTarget;

    document.getElementById("default-break").value =
        settings.defaultBreak;
}

function saveSettings() {
    const target = Number(
        document.getElementById("weekly-target").value
    );

    const breakTime = Number(
        document.getElementById("default-break").value
    );

    if (
        !Number.isFinite(target) || target <= 0 ||
        !Number.isFinite(breakTime) || breakTime < 0
    ) {
        alert("Vérifie les valeurs saisies.");
        return;
    }

    settings.weeklyTarget = target;
    settings.defaultBreak = breakTime;

    saveData();
    refreshApp();

    alert("Réglages enregistrés !");
}

// ==========================================
// 11. NAVIGATION
// ==========================================

document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;

        document.querySelectorAll(".page").forEach(section => {
            section.classList.remove("active");
        });

        document.querySelectorAll(".nav-button").forEach(nav => {
            nav.classList.remove("active");
        });

        document.getElementById(page).classList.add("active");
        button.classList.add("active");
    });
});

// ==========================================
// 12. ACTUALISATION GÉNÉRALE
// ==========================================

function refreshApp() {
    updateHome();
    updateHistory();
    updateStatistics();
    loadSettings();
}

document.getElementById("add-day-button").addEventListener("click", addDay);
document.getElementById("save-settings").addEventListener("click", saveSettings);

refreshApp();

// Activation du mode hors connexion
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("Mode hors connexion activé"))
            .catch(error => console.error("Erreur Service Worker :", error));
    });
}
