// --- App State Management ---
let audioPlaying = false;
let particlesInterval = null;

// Initialize Lucide Icons on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupEventListeners();
    setupDatePickerDefaults();
});

// Set up Date Picker limits and default values
function setupDatePickerDefaults() {
    const today = new Date().toISOString().split('T')[0];
    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        datePicker.min = today;
        datePicker.value = today; // Default to today
    }
    const timePicker = document.getElementById('time-picker');
    if (timePicker) {
        timePicker.value = "19:00"; // Default to 7:00 PM
    }
}

// --- Screen Transitions Router ---
function navigateTo(screenId) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Custom animation triggers depending on screen
        if (screenId === 'reasons-screen') {
            triggerReasonsAnimation();
        } else {
            resetReasonsAnimation();
        }
        
        if (screenId === 'menu-screen') {
            startAmbientParticles();
        }

        // Toggle lyrics positioning class (bottom for home/menu, top for sub-screens)
        const lyricsBg = document.getElementById('lyrics-background');
        if (lyricsBg) {
            if (screenId !== 'welcome-screen' && screenId !== 'menu-screen') {
                lyricsBg.classList.add('sub-screen-active');
            } else {
                lyricsBg.classList.remove('sub-screen-active');
            }
        }
    }
}

// --- Setup Click & Action Handlers ---
function setupEventListeners() {
    // Unlock Surprise Button
    const unlockBtn = document.getElementById('unlock-btn');
    unlockBtn.addEventListener('click', () => {
        unlockSurprise();
    });

    // Music Toggle Button
    const musicBtn = document.getElementById('music-toggle');
    musicBtn.addEventListener('click', () => {
        toggleMusic();
    });

    // Sync Lyrics with Background Music
    const audio = document.getElementById('bg-music');
    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        updateLyrics(currentTime);
        updateSpotifyProgressBar(currentTime, audio.duration);
    });

    // RSVP Yes Button
    const rsvpBtn = document.getElementById('rsvp-yes-btn');
    rsvpBtn.addEventListener('click', () => {
        triggerRsvpAcceptance();
    });

    // Spotify Screen Play/Pause Button
    const spotifyPlayBtn = document.getElementById('spotify-play-btn');
    if (spotifyPlayBtn) {
        spotifyPlayBtn.addEventListener('click', () => {
            toggleMusic();
        });
    }

    // Spotify Screen Seeking Controls (Previous 10s / Next 10s)
    const spotifyPrevBtn = document.getElementById('spotify-prev-btn');
    if (spotifyPrevBtn) {
        spotifyPrevBtn.addEventListener('click', () => {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
        });
    }

    const spotifyNextBtn = document.getElementById('spotify-next-btn');
    if (spotifyNextBtn) {
        spotifyNextBtn.addEventListener('click', () => {
            const duration = audio.duration || 177;
            audio.currentTime = Math.min(duration, audio.currentTime + 10);
        });
    }

    // Spotify Shuffle & Repeat toggles (Visual active state feedback)
    const shuffleBtn = document.getElementById('spotify-shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            shuffleBtn.classList.toggle('secondary');
        });
    }

    const repeatBtn = document.getElementById('spotify-repeat-btn');
    if (repeatBtn) {
        repeatBtn.addEventListener('click', () => {
            repeatBtn.classList.toggle('secondary');
        });
    }

    // Click on progress track to seek
    const progressTrack = document.getElementById('spotify-progress-track');
    if (progressTrack) {
        progressTrack.addEventListener('click', (e) => {
            const rect = progressTrack.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const percent = clickX / width;
            const duration = audio.duration || 177;
            audio.currentTime = percent * duration;
        });
    }

    // Click on individual lyric lines to jump directly to that part of the song!
    const spotifyLyricLines = document.querySelectorAll('.spotify-lyric-line');
    spotifyLyricLines.forEach((line) => {
        line.addEventListener('click', () => {
            const time = parseFloat(line.getAttribute('data-time'));
            if (!isNaN(time)) {
                audio.currentTime = time;
                // If paused, play it automatically to be helpful
                if (!audioPlaying) {
                    toggleMusic();
                }
            }
        });
    });

    // PWA Install Button Click Handler
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again
            deferredPrompt = null;
            // Hide our custom install button
            installBtn.classList.add('hidden');
        });
    }
}

// --- Unlock Event (Plays Music & Transitions) ---
function unlockSurprise() {
    const audio = document.getElementById('bg-music');
    
    // Play Background Audio (Bypasses Browser Restrictions via User Gesture)
    audio.play().then(() => {
        audioPlaying = true;
        updateMusicUi(true);
    }).catch(err => {
        console.log("Audio autoplay blocked or failed:", err);
    });

    // Transition to main menu
    navigateTo('menu-screen');
}

// --- Music Player Controller ---
function toggleMusic() {
    const audio = document.getElementById('bg-music');
    if (audioPlaying) {
        audio.pause();
        audioPlaying = false;
        updateMusicUi(false);
    } else {
        audio.play().then(() => {
            audioPlaying = true;
            updateMusicUi(true);
        }).catch(err => console.log(err));
    }
}

function updateMusicUi(isPlaying) {
    const footer = document.querySelector('.menu-footer');
    if (footer) {
        if (isPlaying) {
            footer.classList.add('music-playing');
        } else {
            footer.classList.remove('music-playing');
        }
    }

    // Update Spotify screen play button icon dynamically
    const spotifyPlayIcon = document.getElementById('spotify-play-icon');
    if (spotifyPlayIcon) {
        if (isPlaying) {
            spotifyPlayIcon.setAttribute('data-lucide', 'pause');
        } else {
            spotifyPlayIcon.setAttribute('data-lucide', 'play');
        }
        lucide.createIcons(); // Re-render Lucide icons to swap play/pause SVGs
    }
}

// --- Background Particle Sparkles & Hearts ---
function startAmbientParticles() {
    if (particlesInterval) return; // Prevent duplicates

    const container = document.getElementById('particles-container');
    
    // Create new particle every 700ms
    particlesInterval = setInterval(() => {
        // Randomly choose between a starlight particle and a tiny heart
        if (Math.random() > 0.45) {
            createStarlight(container);
        } else {
            createHeart(container);
        }
    }, 700);
}

function createStarlight(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random sizes and positions
    const size = Math.random() * 4 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}vw`;
    
    // Random opacity and animations
    particle.style.opacity = Math.random() * 0.5 + 0.2;
    particle.style.animationDuration = `${Math.random() * 6 + 6}s`;

    container.appendChild(particle);

    // Cleanup after animation completes
    setTimeout(() => {
        particle.remove();
    }, 12000);
}

function createHeart(container) {
    const heart = document.createElement('div');
    heart.className = 'heart-particle';
    heart.innerHTML = '❤️';
    
    // Random positions and formatting
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.fontSize = `${Math.random() * 12 + 10}px`;
    heart.style.animationDuration = `${Math.random() * 8 + 8}s`;
    
    container.appendChild(heart);

    // Cleanup
    setTimeout(() => {
        heart.remove();
    }, 16000);
}

// --- Memory Showcase Database ---
const memoriesData = {
    1: {
        src: 'assets/memory1.png',
        title: 'the day distance finally lost',
        caption: `
            <p>for 1.5 years, we only knew each other through screens, thousands of messages, endless calls, random fights, silent nights, misunderstandings, and moments when things felt impossible, but no matter what happened, we always found our way back to each other,</p>
            <p>then came the day we had been waiting for,</p>
            <p>the moment i saw her standing in front of me, everything around me disappeared, all the things i planned to say were gone, i was so lost in her beauty that i honestly wasn't paying attention to anything else, she grabbed my hand, and i just followed her without a second thought,</p>
            <p>which, as it turns out, wasn't the smartest decision,</p>
            <p>a few minutes later, we accidentally walked into the women's metro coach, for a moment neither of us realized it, and when we did, the embarrassment hit instantly, looking back now, it's one of the funniest memories from our first date,</p>
            <p>but my favorite part of that day wasn't the metro incident,</p>
            <p>it was her,</p>
            <p>the same girl who could talk to me for hours online was suddenly so nervous that she was literally shaking when we met, seeing her like that made everything feel real, after all those months of waiting, hoping, and dreaming about this moment, she was finally there beside me,</p>
            <p>this photo isn't perfect,</p>
            <p>our hair isn't perfect, the lighting isn't perfect, the pose isn't perfect,</p>
            <p>but it's my favorite photo because it captured the exact moment when two people who spent 1.5 years loving each other from a distance finally got to stand side by side,</p>
            <p>and honestly, it was even better than we imagined,</p>
        `
    },
    2: {
        src: 'assets/memory2.png',
        title: 'the weekend promise',
        caption: `
            <p>i don't think you ever realized how important that day was to me,</p>
            <p>it was the first time i picked you up from your pw classes, and i remember thinking that i didn't want you going home alone anymore, so i made a promise to myself, no matter what happened, every weekend i'd come pick you up and make sure you got to your metro safely,</p>
            <p>it wasn't anything grand, just a small thing, but somehow those weekends became one of my favorite parts of the week,</p>
            <p>we'd sit together in the metro, talking about random things, laughing at things that weren't even funny, teasing each other for no reason, and turning an ordinary ride home into something i'd look forward to all week,</p>
            <p>and then there was you,</p>
            <p>every time i'd get a little too close or tease you too much, you'd immediately look around and whisper,</p>
            <p>"koi dekh lega yaar"</p>
            <p>and somehow that only made me want to tease you more,</p>
            <p>looking back now, it wasn't really about the metro rides,</p>
            <p>it was about knowing that for a little while, before we both went back to our own lives, i got to be with you,</p>
            <p>just us, talking, laughing, and making memories between a classroom and a metro station,</p>
            <p>a simple routine that slowly became one of my favorite memories with you,</p>
        `
    },
    3: {
        src: 'assets/memory3.png',
        title: 'lost in the woods, found in each other',
        caption: `
            <p>out of all the places we could've gone, we ended up having a date in a jungle,</p>
            <p>sanjay van wasn't filled with loud people, traffic, or the noise of the city, it was just trees, nature, fresh air, and us,</p>
            <p>we spent hours walking around, talking about random things, enjoying every little moment together, and for once it felt like nothing else mattered,</p>
            <p>i still remember looking around at all the greenery and thinking just one thing,</p>
            <p>i hope we can stay here forever,</p>
            <p>not because of the place itself, but because of how peaceful everything felt when i was with you,</p>
            <p>for a little while, it felt like the world had stopped moving,</p>
            <p>there were no worries about going home, no overthinking about the future, no distractions,</p>
            <p>just you, me, and nature,</p>
            <p>sometimes i look back at this photo and realize that what made that day special wasn't the jungle,</p>
            <p>it was the feeling of being completely at peace because you were there beside me,</p>
            <p>and if i could relive one quiet day with you over and over again,</p>
            <p>it would probably be this one,</p>
        `
    },
    4: {
        src: 'assets/memory4.png',
        title: 'our first kiss, the plan was just a hug',
        caption: `
            <p>before our first date, we had already made a plan,</p>
            <p>keep it simple, don't be awkward, and if everything goes well, maybe we'll get a hug,</p>
            <p>that was the entire plan,</p>
            <p>after all, most couples take time to get comfortable around each other, especially after spending so long talking through a screen,</p>
            <p>but somehow, the moment we met, everything felt natural,</p>
            <p>all the nervousness, overthinking, and "what if it gets awkward" thoughts disappeared much faster than we expected,</p>
            <p>and before we knew it, our tiny little plan had completely gone out the window,</p>
            <p>we went from "maybe a hug" to creating a memory neither of us had expected,</p>
            <p>looking back now, what makes me smile isn't that the plan changed,</p>
            <p>it's how comfortable being with you felt,</p>
            <p>for two people meeting in person after so much time online, everything just clicked,</p>
            <p>sometimes the best moments aren't the ones you spend weeks planning,</p>
            <p>they're the ones that happen naturally,</p>
            <p>and somehow, our first date became one of those moments,</p>
        `
    },
    5: {
        src: 'assets/memory5.png',
        title: '29 hours, one call',
        caption: `
            <p>sometimes i still can't believe we actually did it,</p>
            <p>both of our parents happened to go to our hometowns at the same time, and for once there were no interruptions, no one calling us away, no distractions,</p>
            <p>it felt like the universe accidentally gave us a whole day just for us,</p>
            <p>what started as a normal video call turned into something neither of us expected,</p>
            <p>one hour became two, two became five, five became ten, and before we knew it, we had been on a video call for 29 hours straight,</p>
            <p>we ate together, watched each other do random things, talked about everything and nothing, laughed at the dumbest jokes, got sleepy together, woke up together, and somehow never ran out of things to say,</p>
            <p>it didn't feel like a call anymore,</p>
            <p>it felt like we were spending an entire day together, even though we were miles apart,</p>
            <p>for a relationship that started online, moments like this meant everything,</p>
            <p>because even with all the distance between us, we always found ways to make each other feel close,</p>
            <p>29 hours sounds crazy when i say it out loud,</p>
            <p>but when i'm talking to you, time has always had a funny way of disappearing,</p>
        `
    },
    6: {
        src: 'assets/memory6.png',
        title: 'the consent letter',
        caption: `
            <p>out of all the things i expected to do in a relationship,</p>
            <p>signing a consent letter was definitely not one of them,</p>
            <p>but somehow, you managed to make me sign one,</p>
            <p>a whole agreement saying that i love you, that i'm your husband, and that i'll never leave your side,</p>
            <p>looking back, it's honestly one of the funniest things you've ever made me do,</p>
            <p>at the time, you told me you wanted it because you were scared,</p>
            <p>scared that one day i'd leave, scared that maybe you weren't enough, scared that you didn't deserve me,</p>
            <p>and i remember thinking how wrong you were,</p>
            <p>because if i'm being honest,</p>
            <p>you were never the one who didn't deserve me,</p>
            <p>if anything, it was the other way around,</p>
            <p>you've always been more caring than you realize, more understanding than you give yourself credit for, and stronger than you think,</p>
            <p>so while everyone else probably sees that consent letter as a funny joke,</p>
            <p>when i look back at it, i see something else,</p>
            <p>i see a girl who loved so deeply that she wanted reassurance that i'd stay,</p>
            <p>and a boy who would've signed that paper a thousand times if it made her smile,</p>
            <p>still though,</p>
            <p>i'm never letting you forget that you actually made me sign a relationship contract 😭</p>
        `
    }
};

// --- Lightbox Picture Zooming ---
function openLightbox(id) {
    const memory = memoriesData[id];
    if (!memory) return;

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxCaption = document.getElementById('lightbox-caption');

    lightboxImg.src = memory.src;
    lightboxTitle.textContent = memory.title;
    lightboxCaption.innerHTML = memory.caption;
    lightbox.classList.add('active');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
}

// --- Envelope Opening Controller (My Letter) ---
function toggleEnvelope() {
    const envelopeWrapper = document.querySelector('.envelope-wrapper');
    envelopeWrapper.classList.toggle('open');
}

// --- Why I Love You Reasons Animation ---
function triggerReasonsAnimation() {
    const items = document.querySelectorAll('.reason-item');
    items.forEach((item, index) => {
        setTimeout(() => {
            item.classList.add('show');
        }, index * 150); // Speed up stagger delay for 10 items (150ms)
    });
}

function resetReasonsAnimation() {
    const items = document.querySelectorAll('.reason-item');
    items.forEach(item => {
        item.classList.remove('show');
    });
}

// --- Date Night RSVP Confirmation ---
function triggerRsvpAcceptance() {
    const dateInput = document.getElementById('date-picker').value;
    const timeInput = document.getElementById('time-picker').value;

    if (!dateInput || !timeInput) {
        alert("Please pick a date and time first! ❤️");
        return;
    }

    // Format the date nicely using local timezone
    const dateParts = dateInput.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    const formattedDate = dateObj.toLocaleDateString('en-US', options);

    // Format the time nicely
    const timeParts = timeInput.split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${hours}:${minutes} ${ampm}`;

    const rsvpControls = document.getElementById('rsvp-controls');
    const successMsg = document.getElementById('rsvp-success-message');
    const successDetails = document.getElementById('rsvp-success-details');
    const ticket = document.getElementById('date-ticket');

    // Update details in success message
    if (successDetails) {
        successDetails.innerHTML = `Can't wait to see you on <br><span style="color:var(--gold); font-size:16px; font-weight:600; display:inline-block; margin:6px 0;">${formattedDate}</span><br> at <span style="color:var(--accent); font-size:16px; font-weight:600;">${formattedTime}</span>.`;
    }

    // Hide RSVP button and show success block
    rsvpControls.classList.add('hidden');
    successMsg.classList.remove('hidden');
    
    // Visual glow effect on ticket acceptance
    ticket.style.borderColor = 'rgba(255, 51, 102, 0.4)';
    ticket.style.boxShadow = '0 15px 45px rgba(255, 51, 102, 0.25)';

    // Trigger Canvas Confetti Explosion
    triggerConfettiExplosion();
}

function triggerConfettiExplosion() {
    // Custom colors matching our dark / crimson / gold aesthetic
    const colors = ['#ff3366', '#dfb76c', '#ffffff', '#ffccd5'];

    // Left cannon
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.1, y: 0.6 },
        colors: colors
    });

    // Right cannon
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.9, y: 0.6 },
        colors: colors
    });

    // Center spray
    setTimeout(() => {
        confetti({
            particleCount: 100,
            spread: 90,
            origin: { y: 0.55 },
            colors: colors
        });
    }, 250);
}

// --- Lyrics Synchronization Logic (Until I Found You - Stephen Sanchez) ---
const lyricData = [
    { time: 0, text: '' },
    { time: 10.6, text: 'Georgia, wrap me up in all your...' },
    { time: 17.0, text: 'I want ya\', in my arms' },
    { time: 22.4, text: 'Oh, let me hold ya\'' },
    { time: 27.8, text: 'I\'ll never let you go again, like I did' },
    { time: 33.4, text: 'Oh, I used to say' },
    { time: 37.4, text: '"I would never fall in love again until I found her"' },
    { time: 44.2, text: 'I said, "I would never fall unless it\'s you I fall into"' },
    { time: 51.4, text: 'I was lost within the darkness, but then I found her' },
    { time: 58.2, text: 'I found you' },
    { time: 67.7, text: 'Georgia, pulled me in, I asked to...' },
    { time: 74.4, text: 'Love her, once again' },
    { time: 79.5, text: 'You fell, I caught ya\'' },
    { time: 83.3, text: 'I\'ll never let you go again, like I did' },
    { time: 90.7, text: 'Oh, I used to say' },
    { time: 94.2, text: '"I would never fall in love again until I found her"' },
    { time: 101.3, text: 'I said, "I would never fall unless it\'s you I fall into"' },
    { time: 108.4, text: 'I was lost within the darkness, but then I found her' },
    { time: 115.2, text: 'I found you' },
    { time: 136.8, text: '"I would never fall in love again until I found her"' },
    { time: 144.0, text: 'I said, "I would never fall unless it\'s you I fall into"' },
    { time: 151.2, text: 'I was lost within the darkness, but then I found her' },
    { time: 157.9, text: 'I found you' }
];

let currentLyricIndex = -1;

function updateLyrics(currentTime) {
    let activeIndex = -1;
    for (let i = 0; i < lyricData.length; i++) {
        if (currentTime >= lyricData[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }
    
    if (activeIndex !== currentLyricIndex) {
        currentLyricIndex = activeIndex;
        const currentText = currentLyricIndex >= 0 ? lyricData[currentLyricIndex].text : '';
        
        // Update regular floating lyrics & section header lyrics
        displayLyric(currentText);
        
        // Update Spotify lyrics display highlight & scroll centering
        updateSpotifyLyricsHighlight(currentLyricIndex);
    }
}

function displayLyric(text) {
    const lyricElements = document.querySelectorAll('.lyric-line');
    lyricElements.forEach(el => {
        el.classList.remove('active');
        
        setTimeout(() => {
            el.textContent = text;
            if (text) {
                el.classList.add('active');
            }
        }, 200); // 200ms delay to allow opacity transition to complete
    });
}

// --- Spotify Screen Specific Progress Bar & Timing Formatters ---
function updateSpotifyProgressBar(currentTime, duration) {
    const progressFill = document.getElementById('spotify-progress-fill');
    const timeCurrent = document.getElementById('spotify-time-current');
    const timeDuration = document.getElementById('spotify-time-duration');
    
    if (progressFill && timeCurrent) {
        timeCurrent.textContent = formatTime(currentTime);
        
        if (duration && !isNaN(duration)) {
            timeDuration.textContent = formatTime(duration);
            const percent = (currentTime / duration) * 100;
            progressFill.style.width = `${percent}%`;
        } else {
            // Until I Found You fallback duration is 177 seconds (2:57)
            const fallbackDuration = 177;
            timeDuration.textContent = formatTime(fallbackDuration);
            const percent = (currentTime / fallbackDuration) * 100;
            progressFill.style.width = `${percent}%`;
        }
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- Spotify Screen Lyrics Scrolling & Highlight Engine ---
function updateSpotifyLyricsHighlight(activeIndex) {
    const lyricLines = document.querySelectorAll('.spotify-lyric-line');
    if (lyricLines.length === 0) return;
    
    lyricLines.forEach((line, index) => {
        if (index === activeIndex) {
            line.classList.add('active-lyric');
            // Centered smooth scrolling into view
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            line.classList.remove('active-lyric');
        }
    });
}

// --- PWA Custom Install Prompt ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can install the PWA
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed successfully!');
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.add('hidden');
    }
    deferredPrompt = null;
});
