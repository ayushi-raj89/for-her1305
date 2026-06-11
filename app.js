// --- Supabase & Encryption Config ---
// If these are left empty, they will be loaded from localStorage (or prompted in the setup screen).
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let supabase = null;
let cryptoKey = null;
let coupleCode = null;   // hex SHA-256 of shared secret — used as DB row identifier for isolation
let selectedRole = null;
let songQueue = [];
let currentSongIndex = 0;
let loadedMemoriesMap = {};

// --- App State Management ---
let audioPlaying = false;
let particlesInterval = null;

// Opening Screen State
let welcomeStars = [];
let welcomeStarsActive = true;
let isWarpActive = false;
let welcomeCanvas, welcomeCtx;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    setupEventListeners();
    setupDatePickerDefaults();
    initWelcomeStars();
    runWelcomeTyping();

    // Bind setup submit button
    const setupSubmitBtn = document.getElementById('setup-submit-btn');
    if (setupSubmitBtn) {
        setupSubmitBtn.addEventListener('click', handleSetupSubmit);
    }

    // Check first-visit setup status
    const setupOk = await checkFirstVisitSetup();
    if (setupOk) {
        await startApp();
    }
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
            switchReasonsTab('his');
        } else {
            resetReasonsAnimation();
        }
        
        if (screenId === 'secret-screen') {
            initSecretScreen();
            displayDailyQuote();
        } else {
            stopSecretScreen();
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
    // Enter Our World Button
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            triggerEnterWorldTransition();
        });
    }

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

    // Spotify Screen seeking controls: play previous or next song in queue
    const spotifyPrevBtn = document.getElementById('spotify-prev-btn');
    if (spotifyPrevBtn) {
        spotifyPrevBtn.addEventListener('click', () => {
            playPrevSong();
        });
    }

    const spotifyNextBtn = document.getElementById('spotify-next-btn');
    if (spotifyNextBtn) {
        spotifyNextBtn.addEventListener('click', () => {
            playNextSong();
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

// --- Magical Opening Screen Logic ---

function initWelcomeStars() {
    welcomeCanvas = document.getElementById('welcome-stars-canvas');
    if (!welcomeCanvas) return;
    welcomeCtx = welcomeCanvas.getContext('2d');
    
    function resizeCanvas() {
        welcomeCanvas.width = window.innerWidth;
        welcomeCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const numStars = 180;
    welcomeStars = [];
    for (let i = 0; i < numStars; i++) {
        welcomeStars.push({
            x: (Math.random() - 0.5) * welcomeCanvas.width * 2,
            y: (Math.random() - 0.5) * welcomeCanvas.height * 2,
            z: Math.random() * welcomeCanvas.width,
            color: Math.random() > 0.82 ? '#c0392b' : '#ffffff' // Mix subtle glowing red stars
        });
    }
    
    function animate() {
        if (!welcomeStarsActive) return;
        requestAnimationFrame(animate);
        
        if (isWarpActive) {
            welcomeCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            welcomeCtx.fillRect(0, 0, welcomeCanvas.width, welcomeCanvas.height);
        } else {
            welcomeCtx.clearRect(0, 0, welcomeCanvas.width, welcomeCanvas.height);
        }
        
        const centerX = welcomeCanvas.width / 2;
        const centerY = welcomeCanvas.height / 2;
        
        for (let i = 0; i < welcomeStars.length; i++) {
            const star = welcomeStars[i];
            const speed = isWarpActive ? 32 : 0.45;
            star.z -= speed;
            
            if (star.z <= 0) {
                star.x = (Math.random() - 0.5) * welcomeCanvas.width * 2;
                star.y = (Math.random() - 0.5) * welcomeCanvas.height * 2;
                star.z = welcomeCanvas.width;
            }
            
            const px = (star.x / star.z) * centerX + centerX;
            const py = (star.y / star.z) * centerY + centerY;
            
            if (px >= 0 && px < welcomeCanvas.width && py >= 0 && py < welcomeCanvas.height) {
                const size = (1 - star.z / welcomeCanvas.width) * 3 + 0.5;
                const alpha = (1 - star.z / welcomeCanvas.width) * 0.8 + 0.2;
                
                welcomeCtx.fillStyle = star.color === '#ffffff' ? `rgba(255, 255, 255, ${alpha})` : `rgba(192, 57, 43, ${alpha})`;
                welcomeCtx.beginPath();
                welcomeCtx.arc(px, py, size, 0, Math.PI * 2);
                welcomeCtx.fill();
            }
        }
    }
    animate();
}

function runWelcomeTyping() {
    const textEl = document.getElementById('welcome-text');
    if (!textEl) return;
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDate = today.getDate();
    
    let message = "somewhere in this universe... there is a place just for us";
    
    if (currentMonth === 5 && currentDate === 13) {
        message = "happy anniversary, my love! ❤️ somewhere in this universe... there is a place just for us";
    } else if (currentMonth === 10 && currentDate === 15) {
        message = "happy birthday, beautiful! 🎂 somewhere in this universe... there is a place just for us";
    }
    
    let index = 0;
    textEl.textContent = "";
    
    function type() {
        if (index < message.length) {
            textEl.textContent += message.charAt(index);
            index++;
            const char = message.charAt(index - 1);
            let speed = 40;
            if (char === '.' || char === '!' || char === '❤️' || char === '🎂') {
                speed = 350;
            } else if (char === ',') {
                speed = 200;
            } else {
                speed = 35 + Math.random() * 30;
            }
            setTimeout(type, speed);
        } else {
            const enterBtn = document.getElementById('enter-btn');
            if (enterBtn) {
                enterBtn.classList.add('show');
            }
        }
    }
    setTimeout(type, 1500);
}

function triggerEnterWorldTransition() {
    const audio = document.getElementById('bg-music');
    audio.play().then(() => {
        audioPlaying = true;
        updateMusicUi(true);
    }).catch(err => {
        console.log("Audio autoplay blocked or failed:", err);
    });

    isWarpActive = true;
    
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
        enterBtn.classList.remove('show');
        enterBtn.style.pointerEvents = 'none';
    }
    
    const welcomeScreen = document.getElementById('welcome-screen');
    setTimeout(() => {
        welcomeScreen.classList.add('warp-fade');
    }, 300);
    
    setTimeout(() => {
        welcomeScreen.classList.remove('active');
        welcomeStarsActive = false;
        
        navigateTo('menu-screen');
        startAmbientParticles();
        
        updateDaysTogetherCounter();
    }, 2000);
}

function updateDaysTogetherCounter() {
    const counterEl = document.getElementById('days-counter');
    if (!counterEl) return;
    
    const anniversaryDate = new Date('2024-05-13T00:00:00'); // May 13, 2024
    const today = new Date();
    
    const diffTime = today.getTime() - anniversaryDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0) {
        counterEl.textContent = `${diffDays} Days Together`;
    }
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
let memoriesData = {
    1: {
        src: 'assets/memory1.png',
        title: 'the day distance finally lost',
        date: 'May 13, 2024',
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
        date: 'June 8, 2024',
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
        date: 'July 22, 2024',
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
        date: 'August 14, 2024',
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
        date: 'September 30, 2024',
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
        date: 'November 12, 2024',
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
    const lightboxDate = document.getElementById('lightbox-date');
    const lightboxCaption = document.getElementById('lightbox-caption');

    lightboxImg.src = memory.src;
    lightboxTitle.textContent = memory.title;
    if (lightboxDate) {
        lightboxDate.textContent = memory.date;
    }
    lightboxCaption.innerHTML = memory.caption;
    lightbox.classList.add('active');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
}

// --- Love Letters Database ---
let lettersData = {
    'shivam-letter-1': {
        salutation: 'Dearest Ayushi,',
        body: `
            <p>I wanted to take a moment to tell you how incredibly lucky I feel to have you in my life.</p>
            <p>Every day with you is a new adventure, and your smile is literally my favorite thing in the world. You bring so much light and joy into my days.</p>
            <p>I can't wait to make a million more beautiful memories with you.</p>
        `,
        signature: 'Forever yours,<br>Shivam'
    }
};

// --- Love Letters Tab Switcher ---
function switchLettersTab(tab) {
    const himBtn = document.getElementById('tab-letters-him');
    const herBtn = document.getElementById('tab-letters-her');
    const himPanel = document.getElementById('letters-from-him');
    const herPanel = document.getElementById('letters-from-her');

    if (tab === 'him') {
        if (himBtn) himBtn.classList.add('active');
        if (herBtn) herBtn.classList.remove('active');
        if (himPanel) himPanel.classList.add('active');
        if (herPanel) herPanel.classList.remove('active');
    } else {
        if (himBtn) himBtn.classList.remove('active');
        if (herBtn) herBtn.classList.add('active');
        if (himPanel) himPanel.classList.remove('active');
        if (herPanel) herPanel.classList.add('active');
    }
}

// --- Letter Reader Modal ---
function openFullLetter(letterId) {
    const letter = lettersData[letterId];
    if (!letter) return;

    const modal = document.getElementById('letter-reader-modal');
    const display = document.getElementById('full-letter-display');
    
    if (display) {
        display.innerHTML = `
            <div class="letter-modal-salutation">${letter.salutation}</div>
            <div style="font-family: var(--font-sans); font-size: 15px; line-height: 1.8; color: #f5eedc; margin-bottom: 24px;">
                ${letter.body}
            </div>
            <div class="letter-modal-signature">${letter.signature}</div>
        `;
    }
    
    if (modal) {
        modal.classList.add('active');
    }
}

function closeFullLetter() {
    const modal = document.getElementById('letter-reader-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// --- Why I Love You Reasons Animation ---
function triggerReasonsAnimation() {
    const items = document.querySelectorAll('.reason-item');
    items.forEach((item, index) => {
        setTimeout(() => {
            item.classList.add('show');
        }, index * 120); // Speed up stagger delay
    });
}

function resetReasonsAnimation() {
    const items = document.querySelectorAll('.reason-item');
    items.forEach(item => {
        item.classList.remove('show');
    });
}

// --- Why I Love You Tab Switcher ---
function switchReasonsTab(tab) {
    const hisBtn = document.getElementById('tab-reasons-his');
    const herBtn = document.getElementById('tab-reasons-her');
    const hisPanel = document.getElementById('reasons-his');
    const herPanel = document.getElementById('reasons-her');
    const addRow = document.getElementById('reasons-add-row');

    const currentUser = localStorage.getItem('current_user');

    if (tab === 'his') {
        if (hisBtn) hisBtn.classList.add('active');
        if (herBtn) herBtn.classList.remove('active');
        if (hisPanel) hisPanel.classList.add('active');
        if (herPanel) herPanel.classList.remove('active');
        
        if (addRow) {
            if (currentUser === 'Shivam') {
                addRow.classList.remove('hidden');
            } else {
                addRow.classList.add('hidden');
            }
        }
        
        resetReasonsAnimation();
        setTimeout(triggerReasonsAnimation, 50);
    } else {
        if (hisBtn) hisBtn.classList.remove('active');
        if (herBtn) herBtn.classList.add('active');
        if (hisPanel) hisPanel.classList.remove('active');
        if (herPanel) herPanel.classList.add('active');
        
        if (addRow) {
            if (currentUser === 'Ayushi') {
                addRow.classList.remove('hidden');
            } else {
                addRow.classList.add('hidden');
            }
        }
        
        resetReasonsAnimation();
        setTimeout(triggerReasonsAnimation, 50);
    }
}

// --- Date Night RSVP Confirmation ---
function triggerRsvpAcceptance() {
    const dateInput = document.getElementById('date-picker').value;
    const timeInput = document.getElementById('time-picker').value;
    const placeInput = document.getElementById('place-picker').value.trim() || 'Our Special Spot';
    const activityInput = document.getElementById('activity-picker').value.trim() || 'Spending Sweet Time Together';

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
        successDetails.innerHTML = `
            Can't wait to see you on <br>
            <span style="color:var(--gold); font-size:16px; font-weight:600; display:inline-block; margin:6px 0;">${formattedDate}</span><br>
            at <span style="color:var(--accent); font-size:16px; font-weight:600; display:inline-block; margin-bottom:6px;">${formattedTime}</span>.<br>
            <span style="color:var(--text-secondary); font-size:13px;">Place: <b>${placeInput}</b></span><br>
            <span style="color:var(--text-secondary); font-size:13px;">Activity: <b>${activityInput}</b></span>
        `;
    }

    // Hide RSVP button and show success block
    rsvpControls.classList.add('hidden');
    successMsg.classList.remove('hidden');
    
    // Visual glow effect on ticket acceptance
    ticket.style.borderColor = 'rgba(192, 57, 43, 0.45)';
    ticket.style.boxShadow = '0 15px 45px rgba(192, 57, 43, 0.3)';

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
            // Centered smooth scrolling into view without window scrolling side-effects
            const container = document.getElementById('spotify-lyrics-list');
            if (container) {
                const containerHeight = container.clientHeight;
                const lineOffsetTop = line.offsetTop;
                const lineHeight = line.clientHeight;
                container.scrollTo({
                    top: lineOffsetTop - (containerHeight / 2) + (lineHeight / 2),
                    behavior: 'smooth'
                });
            }
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

// --- Our World Secret Screen Logic ---

let secretCanvas, secretCtx;
let secretStars = [];
let secretNebulaTime = 0;
let secretStarsActive = false;
let secretZoomSpeed = 30;

const LOVE_QUOTES = [
    "You are my today and all of my tomorrows. ❤️",
    "In a sea of people, my eyes will always search for you.",
    "If I know what love is, it is because of you.",
    "My heart is and always will be yours. 🌹",
    "To the world you may be one person, but to me you are the world.",
    "I love you more than words can show, I think about you more than you could know.",
    "Distance means so little when someone means so much.",
    "Every love story is beautiful, but ours is my favorite.",
    "Together with you is my favorite place to be. ✨",
    "You make my heart smile in ways nobody else can.",
    "You are my favorite notification. 😊",
    "We love because it's the only true adventure.",
    "You are the best thing that's ever been mine.",
    "You make me want to be a better person.",
    "You are my home, my peace, and my beautiful chaos.",
    "In your smile, I see something more beautiful than the stars.",
    "Loving you is the easiest thing I have ever done. ❤️",
    "My favorite place in the universe is right next to you.",
    "You are the music that my heart beats to. 🎶",
    "With you, time stands still and forever doesn't seem long enough.",
    "You have a place in my heart no one else could ever have.",
    "I would walk through a thousand universes just to hold your hand.",
    "You are my calm in the middle of any storm.",
    "Every day spent with you is my favorite day. So, today is my new favorite day.",
    "I love you not only for what you are, but for what I am when I am with you.",
    "You are my heart's permanent home. 🏠",
    "I need you like a heart needs a beat.",
    "You are the poem I never knew how to write, and this life is the story I always wanted to tell.",
    "You are my anchor in this crazy universe.",
    "My love for you is a journey, starting at forever and ending at never."
];

function initSecretScreen() {
    secretCanvas = document.getElementById('secret-canvas');
    if (!secretCanvas) return;
    secretCtx = secretCanvas.getContext('2d');
    
    function resizeCanvas() {
        if (!secretCanvas) return;
        secretCanvas.width = window.innerWidth;
        secretCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create secret stars
    const numStars = 120;
    secretStars = [];
    for (let i = 0; i < numStars; i++) {
        secretStars.push({
            x: (Math.random() - 0.5) * secretCanvas.width * 2,
            y: (Math.random() - 0.5) * secretCanvas.height * 2,
            z: Math.random() * secretCanvas.width,
            twinkle: Math.random() * 0.04 + 0.01,
            twinkleDir: Math.random() > 0.5 ? 1 : -1,
            opacity: Math.random() * 0.8 + 0.2
        });
    }
    
    secretNebulaTime = 0;
    secretZoomSpeed = 30; // High speed entry zoom
    secretStarsActive = true;
    
    function animate() {
        if (!secretStarsActive || !secretCanvas) return;
        requestAnimationFrame(animate);
        
        // Decelerate zoom speed slowly until it reaches normal drift speed of 0.4
        if (secretZoomSpeed > 0.45) {
            secretZoomSpeed -= 0.65;
        } else {
            secretZoomSpeed = 0.45;
        }
        
        // 1. Draw Nebula background
        secretNebulaTime += 0.002;
        const h1 = 260 + Math.sin(secretNebulaTime) * 35; // purples
        const h2 = 200 + Math.cos(secretNebulaTime * 0.8) * 30; // dark blues
        const h3 = 345 + Math.sin(secretNebulaTime * 0.5) * 15; // soft reds
        
        const width = secretCanvas.width;
        const height = secretCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        const gradient = secretCtx.createRadialGradient(
            centerX + Math.sin(secretNebulaTime * 1.5) * (width * 0.25),
            centerY + Math.cos(secretNebulaTime) * (height * 0.25),
            10,
            centerX,
            centerY,
            Math.max(width, height) * 0.8
        );
        
        gradient.addColorStop(0, `hsla(${h1}, 70%, 10%, 1)`);
        gradient.addColorStop(0.4, `hsla(${h2}, 60%, 7%, 1)`);
        gradient.addColorStop(0.7, `hsla(${h3}, 55%, 8%, 0.8)`);
        gradient.addColorStop(1, '#050505');
        
        secretCtx.fillStyle = gradient;
        secretCtx.fillRect(0, 0, width, height);
        
        // 2. Draw projected stars
        for (let i = 0; i < secretStars.length; i++) {
            const star = secretStars[i];
            star.z -= secretZoomSpeed;
            
            if (star.z <= 0) {
                star.x = (Math.random() - 0.5) * secretCanvas.width * 2;
                star.y = (Math.random() - 0.5) * secretCanvas.height * 2;
                star.z = secretCanvas.width;
            }
            
            const px = (star.x / star.z) * centerX + centerX;
            const py = (star.y / star.z) * centerY + centerY;
            
            if (px >= 0 && px < width && py >= 0 && py < height) {
                // Twinkle stars only at normal speed
                if (secretZoomSpeed <= 0.5) {
                    star.opacity += star.twinkle * star.twinkleDir;
                    if (star.opacity >= 1) {
                        star.opacity = 1;
                        star.twinkleDir = -1;
                    } else if (star.opacity <= 0.15) {
                        star.opacity = 0.15;
                        star.twinkleDir = 1;
                    }
                }
                
                const size = (1 - star.z / secretCanvas.width) * 3 + 0.3;
                
                secretCtx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
                secretCtx.beginPath();
                secretCtx.arc(px, py, size, 0, Math.PI * 2);
                secretCtx.fill();
            }
        }
    }
    animate();
}

function stopSecretScreen() {
    secretStarsActive = false;
}

function exitSecretScreen() {
    stopSecretScreen();
    navigateTo('menu-screen');
}

function displayDailyQuote() {
    const quoteEl = document.getElementById('daily-quote');
    if (!quoteEl) return;
    
    const today = new Date();
    const dayIndex = (today.getFullYear() * 372 + today.getMonth() * 31 + today.getDate()) % LOVE_QUOTES.length;
    
    quoteEl.textContent = `"${LOVE_QUOTES[dayIndex]}"`;
}

// --- Cryptography Service (E2E Symmetric Encryption via TweetNaCl.js) ---

async function deriveKey(secretCode) {
    const encoder = new TextEncoder();
    const data = encoder.encode(secretCode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

function uint8ArrayToBase64(arr) {
    let binary = '';
    const len = arr.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
}

function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function encryptText(plaintext, key) {
    if (!key) throw new Error("Key not initialized");
    const encoder = new TextEncoder();
    const messageUint8 = encoder.encode(plaintext);
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.secretbox(messageUint8, nonce, key);
    
    // Combine nonce and encrypted data
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    
    return uint8ArrayToBase64(combined);
}

function decryptText(ciphertextBase64, key) {
    if (!key) throw new Error("Key not initialized");
    try {
        const combined = base64ToUint8Array(ciphertextBase64);
        if (combined.length < 24) return "";
        const nonce = combined.slice(0, 24);
        const encrypted = combined.slice(24);
        const decrypted = nacl.secretbox.open(encrypted, nonce, key);
        if (!decrypted) {
            console.error("Decryption returned null (wrong key/corrupted).");
            return "[Decryption Error]";
        }
        return new TextDecoder().decode(decrypted);
    } catch (err) {
        console.error("Decryption failed:", err);
        return "[Decryption Error]";
    }
}

function encryptJson(obj, key) {
    return encryptText(JSON.stringify(obj), key);
}

function decryptJson(ciphertextBase64, key) {
    const text = decryptText(ciphertextBase64, key);
    if (text === "[Decryption Error]" || !text) return null;
    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("Failed to parse decrypted JSON:", err);
        return null;
    }
}

function getDecryptedFileUrl(fileUrl, key) {
    if (!fileUrl) return "";
    try {
        const decrypted = decryptText(fileUrl, key);
        if (decrypted && decrypted !== "[Decryption Error]") {
            return decrypted;
        }
    } catch (e) {
        // Ignore
    }
    return fileUrl;
}

// --- First-Visit Setup Flow ---

async function checkFirstVisitSetup() {
    const hasCode = localStorage.getItem('shared_secret_code');
    const hasRole = localStorage.getItem('current_user');
    const hasSupabaseUrl = SUPABASE_URL || localStorage.getItem('supabase_url');
    const hasSupabaseKey = SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key');
    
    if (!hasCode || !hasRole || !hasSupabaseUrl || !hasSupabaseKey) {
        // Show setup overlay
        const setupScreen = document.getElementById('setup-screen');
        if (setupScreen) {
            setupScreen.classList.remove('hidden');
        }
        
        // Show/hide Supabase fields based on hardcoded constants
        const supabaseFields = document.getElementById('setup-supabase-fields');
        if (supabaseFields) {
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                supabaseFields.classList.remove('hidden');
            } else {
                supabaseFields.classList.add('hidden');
            }
        }
        return false;
    }
    
    // Setup already complete
    initSupabase();
    await initCryptoKey();
    return true;
}

// Derive a stable hex string from the secret code for use as couple_code in Supabase rows.
// This is separate from the 32-byte cryptoKey used for nacl encryption.
async function deriveCoupleCode(secretCode) {
    const encoder = new TextEncoder();
    const data = encoder.encode('couple:' + secretCode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function initSupabase() {
    const url = SUPABASE_URL || localStorage.getItem('supabase_url');
    const key = SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key');
    if (url && key && window.supabase) {
        supabase = window.supabase.createClient(url, key);
        console.log("Supabase client initialized.");
        return true;
    }
    return false;
}

async function initCryptoKey() {
    const secret = localStorage.getItem('shared_secret_code');
    if (secret) {
        cryptoKey = await deriveKey(secret);
        coupleCode = await deriveCoupleCode(secret);
        return true;
    }
    return false;
}

function selectSetupRole(role) {
    selectedRole = role;
    const shivamBtn = document.getElementById('role-shivam-btn');
    const ayushiBtn = document.getElementById('role-ayushi-btn');
    
    if (role === 'Shivam') {
        if (shivamBtn) shivamBtn.classList.add('active');
        if (ayushiBtn) ayushiBtn.classList.remove('active');
    } else if (role === 'Ayushi') {
        if (shivamBtn) shivamBtn.classList.remove('active');
        if (ayushiBtn) ayushiBtn.classList.add('active');
    }
}

async function handleSetupSubmit() {
    const codeInput = document.getElementById('setup-secret-code');
    const code = codeInput ? codeInput.value.trim() : "";
    
    if (!code) {
        alert("Please enter a shared secret code!");
        return;
    }
    
    if (!selectedRole) {
        alert("Please select who you are (Shivam or Ayushi)!");
        return;
    }
    
    let url = SUPABASE_URL;
    let key = SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        const urlInput = document.getElementById('setup-supabase-url');
        const keyInput = document.getElementById('setup-supabase-key');
        url = urlInput ? urlInput.value.trim() : "";
        key = keyInput ? keyInput.value.trim() : "";
        
        if (!url || !key) {
            alert("Please enter both Supabase URL and Anon Key!");
            return;
        }
        
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_anon_key', key);
    }
    
    localStorage.setItem('shared_secret_code', code);
    localStorage.setItem('current_user', selectedRole);
    
    initSupabase();
    cryptoKey = await deriveKey(code);
    coupleCode = await deriveCoupleCode(code);
    
    const setupScreen = document.getElementById('setup-screen');
    if (setupScreen) {
        setupScreen.classList.add('hidden');
    }
    
    await startApp();
}

// --- Main Application Lifecycle & Dynamic Boot ---

async function startApp() {
    if (!supabase || !coupleCode) {
        console.warn('startApp: Supabase or coupleCode not ready — skipping dynamic data load.');
        updateUserConstraints();
        return;
    }
    await seedInitialDatabase();
    
    await loadMemories();
    await loadSongs();
    await loadLetters();
    await loadReasons();
    
    subscribeToRealtime();
    updateUserConstraints();
}

function updateUserConstraints() {
    const currentUser = localStorage.getItem('current_user');
    // Set appropriate display configuration rules
    console.log(`Logged in as: ${currentUser}`);
}

// --- Supabase Realtime Subscription Service ---

function subscribeToRealtime() {
    if (!supabase || !coupleCode) return;
    
    // Use couple_code in channel name so different couples don't interfere
    supabase
        .channel(`realtime-memories-${coupleCode.substring(0, 8)}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'memories',
            filter: `couple_code=eq.${coupleCode}`
        }, () => { loadMemories(); })
        .subscribe();
        
    supabase
        .channel(`realtime-songs-${coupleCode.substring(0, 8)}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'songs',
            filter: `couple_code=eq.${coupleCode}`
        }, () => { loadSongs(); })
        .subscribe();
        
    supabase
        .channel(`realtime-letters-${coupleCode.substring(0, 8)}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'letters',
            filter: `couple_code=eq.${coupleCode}`
        }, () => { loadLetters(); })
        .subscribe();
        
    supabase
        .channel(`realtime-reasons-${coupleCode.substring(0, 8)}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'reasons',
            filter: `couple_code=eq.${coupleCode}`
        }, () => { loadReasons(); })
        .subscribe();
}

// --- Seeding Routine ---

const seedReasonsList = [
    "The way you hold my hand so tightly when we walk, making me feel like the luckiest person in the world.",
    "Your adorable nervousness on our very first date when you were literally shaking.",
    "The cute way you whisper 'koi dekh lega yaar' whenever I get a little too close in public.",
    "How we can talk on a video call for 29 hours straight and still never run out of things to say.",
    "Your sweet laugh that completely melts away all my worries and stress instantly.",
    "How you made me sign a whole consent letter contract to make sure I'll never leave your side.",
    "The peace and calm I feel when we are walking together in quiet places like Sanjay Van.",
    "The way you care about the smallest details of my day, checking if I ate or slept well.",
    "Your absolute comfort and natural warmth that made our first hug feel like coming home.",
    "The simple fact that you are my home, my peace, and my entire world."
];

async function seedInitialDatabase() {
    if (!coupleCode) {
        console.warn('seedInitialDatabase: coupleCode not set, skipping seed.');
        return;
    }
    try {
        // 1. Seed Memories
        const { data: memData, error: memErr } = await supabase.from('memories').select('id').eq('couple_code', coupleCode).limit(1);
        if (!memErr && (!memData || memData.length === 0)) {
            console.log("Seeding initial memories...");
            // Seed memoriesData
            const fallbackMemories = {
                1: {
                    src: 'assets/memory1.png',
                    title: 'the day distance finally lost',
                    date: 'May 13, 2024',
                    caption: `<p>for 1.5 years, we only knew each other through screens, thousands of messages, endless calls, random fights, silent nights, misunderstandings, and moments when things felt impossible, but no matter what happened, we always found our way back to each other,</p>
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
                        <p>and honestly, it was even better than we imagined,</p>`
                },
                2: {
                    src: 'assets/memory2.png',
                    title: 'the weekend promise',
                    date: 'June 8, 2024',
                    caption: `<p>i don't think you ever realized how important that day was to me,</p>
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
                        <p>a simple routine that slowly became one of my favorite memories with you,</p>`
                },
                3: {
                    src: 'assets/memory3.png',
                    title: 'lost in the woods, found in each other',
                    date: 'July 22, 2024',
                    caption: `<p>out of all the places we could've gone, we ended up having a date in a jungle,</p>
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
                        <p>it would probably be this one,</p>`
                },
                4: {
                    src: 'assets/memory4.png',
                    title: 'our first kiss, the plan was just a hug',
                    date: 'August 14, 2024',
                    caption: `<p>before our first date, we had already made a plan,</p>
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
                        <p>and somehow, our first date became one of those moments,</p>`
                },
                5: {
                    src: 'assets/memory5.png',
                    title: '29 hours, one call',
                    date: 'September 30, 2024',
                    caption: `<p>sometimes i still can't believe we actually did it,</p>
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
                        <p>but when i'm talking to you, time has always had a funny way of disappearing,</p>`
                },
                6: {
                    src: 'assets/memory6.png',
                    title: 'the consent letter',
                    date: 'November 12, 2024',
                    caption: `<p>out of all the things i expected to do in a relationship,</p>
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
                        <p>i'm never letting you forget that you actually made me sign a relationship contract 😭</p>`
                }
            };
            
            for (let id in fallbackMemories) {
                const mem = fallbackMemories[id];
                const encData = encryptJson({
                    title: mem.title,
                    caption: mem.caption,
                    date: mem.date
                }, cryptoKey);
                
                await supabase.from('memories').insert({
                    encrypted_data: encData,
                    file_url: encryptText(mem.src, cryptoKey),
                    uploaded_by: localStorage.getItem('current_user') || 'Shivam',
                    couple_code: coupleCode
                });
            }
        }
        
        // 2. Seed Songs
        const { data: songData, error: songErr } = await supabase.from('songs').select('id').eq('couple_code', coupleCode).limit(1);
        if (!songErr && (!songData || songData.length === 0)) {
            console.log("Seeding initial song...");
            const encData = encryptJson({
                title: 'Until I Found You',
                artist: 'Stephen Sanchez'
            }, cryptoKey);
            await supabase.from('songs').insert({
                encrypted_data: encData,
                file_url: encryptText('assets/bg_music.mp3', cryptoKey),
                uploaded_by: localStorage.getItem('current_user') || 'Shivam',
                couple_code: coupleCode
            });
        }
        
        // 3. Seed Letters
        const { data: letterData, error: letterErr } = await supabase.from('letters').select('id').eq('couple_code', coupleCode).limit(1);
        if (!letterErr && (!letterData || letterData.length === 0)) {
            console.log("Seeding initial letter...");
            const encData = encryptJson({
                salutation: 'Dearest Ayushi,',
                body: `<p>I wanted to take a moment to tell you how incredibly lucky I feel to have you in my life.</p>
                       <p>Every day with you is a new adventure, and your smile is literally my favorite thing in the world. You bring so much light and joy into my days.</p>
                       <p>I can't wait to make a million more beautiful memories with you.</p>`,
                signature: 'Forever yours,<br>Shivam'
            }, cryptoKey);
            
            await supabase.from('letters').insert({
                encrypted_data: encData,
                written_by: localStorage.getItem('current_user') || 'Shivam',
                couple_code: coupleCode
            });
        }
        
        // 4. Seed Reasons
        const { data: reasonsData, error: reasonsErr } = await supabase.from('reasons').select('id').eq('couple_code', coupleCode).limit(1);
        if (!reasonsErr && (!reasonsData || reasonsData.length === 0)) {
            console.log("Seeding initial reasons...");
            for (const r of seedReasonsList) {
                const encData = encryptText(r, cryptoKey);
                await supabase.from('reasons').insert({
                    encrypted_data: encData,
                    written_by: localStorage.getItem('current_user') || 'Shivam',
                    couple_code: coupleCode
                });
            }
        }
    } catch (err) {
        console.error("Error during initial seeding:", err);
    }
}

// --- Memories Management ---

async function loadMemories() {
    try {
        const { data, error } = await supabase.from('memories').select('*').eq('couple_code', coupleCode).order('created_at', { ascending: true });
        if (error) throw error;
        
        memoriesData = {};
        const grid = document.getElementById('memories-gallery-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        data.forEach((mem, index) => {
            let decrypted = null;
            try {
                decrypted = decryptJson(mem.encrypted_data, cryptoKey);
            } catch (e) {
                console.error("Error decrypting memory", e);
            }
            if (!decrypted) return;
            
            const title = decrypted.title || "Untitled Memory";
            const caption = decrypted.caption || "";
            const date = decrypted.date || new Date(mem.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const fileUrl = getDecryptedFileUrl(mem.file_url, cryptoKey);
            const uploadedBy = mem.uploaded_by || "Shivam";
            
            memoriesData[mem.id] = {
                src: fileUrl,
                title: title,
                date: date,
                caption: caption
            };
            
            // Build text snippet for card
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = caption;
            const plainText = tempDiv.textContent || tempDiv.innerText || "";
            const snippet = plainText.length > 80 ? plainText.substring(0, 80) + '...' : plainText;
            
            const card = document.createElement('button');
            card.className = 'gallery-item glass-card';
            card.style.setProperty('--item-index', index + 1);
            card.onclick = () => openLightbox(mem.id);
            
            const tagClass = uploadedBy.toLowerCase() === 'shivam' ? 'shivam-tag' : 'ayushi-tag';
            
            card.innerHTML = `
                <div class="gallery-img-container">
                    <img src="${fileUrl}" alt="${title}" loading="lazy">
                </div>
                <div class="gallery-card-content">
                    <span class="gallery-card-date">${date}</span>
                    <h3 class="gallery-card-title">${title}</h3>
                    <p class="gallery-card-desc">${snippet}</p>
                    <div class="gallery-card-footer">
                        <span class="gallery-card-tag ${tagClass}">Uploaded by ${uploadedBy}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        
        // Apply immediate entrance styles to items if memories active
        const memoriesScreen = document.getElementById('memories-screen');
        if (memoriesScreen && memoriesScreen.classList.contains('active')) {
            setTimeout(() => {
                const items = grid.querySelectorAll('.gallery-item');
                items.forEach(item => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0) scale(1)';
                });
            }, 50);
        }
    } catch (err) {
        console.error("Failed loading memories:", err);
    }
}

async function handleMemorySubmit(event) {
    event.preventDefault();
    const titleInput = document.getElementById('memory-title');
    const descInput = document.getElementById('memory-desc');
    const fileInput = document.getElementById('memory-file');
    
    if (!titleInput || !descInput || !fileInput) return;
    
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    const file = fileInput.files[0];
    
    if (!title || !desc || !file) {
        alert("Please fill in all memory fields!");
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sharing...</span><i class="btn-icon spinner"></i>';
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('memories-bucket')
            .upload(fileName, file);
            
        if (uploadErr) throw uploadErr;
        
        const { data: { publicUrl } } = supabase.storage
            .from('memories-bucket')
            .getPublicUrl(fileName);
            
        const encryptedData = encryptJson({
            title: title,
            caption: `<p>${desc.replace(/\n/g, '</p><p>')}</p>`,
            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        }, cryptoKey);
        
        const encryptedUrl = encryptText(publicUrl, cryptoKey);
        const currentUser = localStorage.getItem('current_user') || 'Shivam';
        
        const { error: insertErr } = await supabase.from('memories').insert({
            encrypted_data: encryptedData,
            file_url: encryptedUrl,
            uploaded_by: currentUser,
            couple_code: coupleCode
        });
        
        if (insertErr) throw insertErr;
        
        event.target.reset();
        closeModal('add-memory-modal');
        await loadMemories();
        alert("Memory shared successfully! ❤️");
    } catch (err) {
        console.error("Failed adding memory:", err);
        alert("Error sharing memory. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// --- Music Library Management ---

async function loadSongs() {
    try {
        const { data, error } = await supabase.from('songs').select('*').eq('couple_code', coupleCode).order('created_at', { ascending: true });
        if (error) throw error;
        
        songQueue = [];
        const listContainer = document.getElementById('spotify-song-list-container');
        if (listContainer) listContainer.innerHTML = '';
        
        data.forEach((song, index) => {
            let decrypted = null;
            try {
                decrypted = decryptJson(song.encrypted_data, cryptoKey);
            } catch (e) {
                console.error("Error decrypting song", e);
            }
            if (!decrypted) return;
            
            const title = decrypted.title || "Unknown Song";
            const artist = decrypted.artist || "Unknown Artist";
            const fileUrl = getDecryptedFileUrl(song.file_url, cryptoKey);
            const uploadedBy = song.uploaded_by || "Shivam";
            
            const songObj = {
                id: song.id,
                title: title,
                artist: artist,
                src: fileUrl,
                uploadedBy: uploadedBy
            };
            songQueue.push(songObj);
            
            if (listContainer) {
                const item = document.createElement('div');
                item.className = `spotify-song-item ${index === currentSongIndex ? 'active' : ''}`;
                item.onclick = () => selectAndPlaySong(index);
                
                const tagClass = uploadedBy.toLowerCase() === 'shivam' ? 'shivam-tag' : 'ayushi-tag';
                
                item.innerHTML = `
                    <div class="song-item-info">
                        <div class="song-item-title">${title}</div>
                        <div class="song-item-artist">${artist}</div>
                    </div>
                    <span class="song-item-tag ${tagClass}">By ${uploadedBy}</span>
                `;
                listContainer.appendChild(item);
            }
        });
        
        if (songQueue.length > 0) {
            updatePlayerDetails();
        }
    } catch (err) {
        console.error("Error loading songs:", err);
    }
}

function updatePlayerDetails() {
    const song = songQueue[currentSongIndex];
    if (!song) return;
    
    const titleEl = document.querySelector('.spotify-song-title');
    const artistEl = document.querySelector('.spotify-song-artist');
    
    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    
    const audio = document.getElementById('bg-music');
    if (audio && audio.src !== song.src) {
        audio.src = song.src;
    }
}

function selectAndPlaySong(index) {
    if (index < 0 || index >= songQueue.length) return;
    currentSongIndex = index;
    
    const items = document.querySelectorAll('.spotify-song-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    const song = songQueue[currentSongIndex];
    const audio = document.getElementById('bg-music');
    if (audio) {
        audio.src = song.src;
        updatePlayerDetails();
        updateLyricsDisplayForSong(song.title);
        changeAlbumArtRandomly();
        
        audio.play().then(() => {
            audioPlaying = true;
            updateMusicUi(true);
        }).catch(err => console.log(err));
    }
}

function playNextSong() {
    if (songQueue.length === 0) return;
    let nextIndex = currentSongIndex + 1;
    if (nextIndex >= songQueue.length) {
        nextIndex = 0;
    }
    selectAndPlaySong(nextIndex);
}

function playPrevSong() {
    if (songQueue.length === 0) return;
    let prevIndex = currentSongIndex - 1;
    if (prevIndex < 0) {
        prevIndex = songQueue.length - 1;
    }
    selectAndPlaySong(prevIndex);
}

function changeAlbumArtRandomly() {
    const memoryKeys = Object.keys(memoriesData);
    let coverUrl = 'assets/memory1.png'; // fallback
    
    if (memoryKeys.length > 0) {
        const randomKey = memoryKeys[Math.floor(Math.random() * memoryKeys.length)];
        coverUrl = memoriesData[randomKey].src;
    }
    
    const coverImg = document.querySelector('.spotify-cover-img');
    const bgBlur = document.querySelector('.spotify-bg-blur');
    
    if (coverImg) coverImg.src = coverUrl;
    if (bgBlur) bgBlur.style.backgroundImage = `url('${coverUrl}')`;
}

function updateLyricsDisplayForSong(songTitle) {
    const lyricsList = document.getElementById('spotify-lyrics-list');
    if (!lyricsList) return;
    
    lyricsList.innerHTML = '';
    
    if (songTitle.toLowerCase().includes('until i found you')) {
        lyricData.forEach(lyric => {
            if (lyric.text) {
                const line = document.createElement('div');
                line.className = 'spotify-lyric-line';
                line.setAttribute('data-time', lyric.time);
                line.textContent = lyric.text.toLowerCase();
                
                line.addEventListener('click', () => {
                    const audio = document.getElementById('bg-music');
                    if (audio) {
                        audio.currentTime = lyric.time;
                        if (!audioPlaying) toggleMusic();
                    }
                });
                
                lyricsList.appendChild(line);
            }
        });
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'spotify-lyric-line active-lyric';
        placeholder.style.textAlign = 'center';
        placeholder.style.marginTop = '80px';
        placeholder.style.fontFamily = 'var(--font-heading)';
        placeholder.style.fontSize = '22px';
        placeholder.style.fontStyle = 'italic';
        placeholder.style.lineHeight = '1.8';
        placeholder.innerHTML = `
            "listening to our song together..." <br>
            <span style="font-size: 14px; font-family: var(--font-sans); color: var(--text-secondary); font-style: normal;">
                (synced lyrics are only available for our theme song)
            </span>
        `;
        lyricsList.appendChild(placeholder);
    }
}

async function handleSongSubmit(event) {
    event.preventDefault();
    const titleInput = document.getElementById('song-title-input');
    const artistInput = document.getElementById('song-artist-input');
    const fileInput = document.getElementById('song-file');
    
    if (!titleInput || !artistInput || fileInput === null) return;
    
    const title = titleInput.value.trim();
    const artist = artistInput.value.trim();
    const file = fileInput.files[0];
    
    if (!title || !artist || !file) {
        alert("Please fill in all fields!");
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Uploading...</span><i class="btn-icon spinner"></i>';
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('songs-bucket')
            .upload(fileName, file);
            
        if (uploadErr) throw uploadErr;
        
        const { data: { publicUrl } } = supabase.storage
            .from('songs-bucket')
            .getPublicUrl(fileName);
            
        const encryptedData = encryptJson({
            title: title,
            artist: artist
        }, cryptoKey);
        
        const encryptedUrl = encryptText(publicUrl, cryptoKey);
        const currentUser = localStorage.getItem('current_user') || 'Shivam';
        
        const { error: insertErr } = await supabase.from('songs').insert({
            encrypted_data: encryptedData,
            file_url: encryptedUrl,
            uploaded_by: currentUser,
            couple_code: coupleCode
        });
        
        if (insertErr) throw insertErr;
        
        event.target.reset();
        closeModal('add-song-modal');
        await loadSongs();
        alert("Song uploaded to library! 🎶");
    } catch (err) {
        console.error("Failed uploading song:", err);
        alert("Error uploading song. Try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// Attach Ended handler to audio loop
document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('bg-music');
    if (audio) {
        // Remove standard loop soended listener gets called
        audio.removeAttribute('loop');
        
        audio.addEventListener('ended', () => {
            const repeatBtn = document.getElementById('spotify-repeat-btn');
            const isRepeatActive = repeatBtn && !repeatBtn.classList.contains('secondary');
            
            if (isRepeatActive) {
                audio.currentTime = 0;
                audio.play().catch(e => console.log(e));
            } else {
                const shuffleBtn = document.getElementById('spotify-shuffle-btn');
                const isShuffleActive = shuffleBtn && !shuffleBtn.classList.contains('secondary');
                
                if (isShuffleActive && songQueue.length > 1) {
                    let randomIndex;
                    do {
                        randomIndex = Math.floor(Math.random() * songQueue.length);
                    } while (randomIndex === currentSongIndex);
                    selectAndPlaySong(randomIndex);
                } else {
                    playNextSong();
                }
            }
        });
    }
});

// --- Love Letters Management ---

async function loadLetters() {
    try {
        const { data, error } = await supabase.from('letters').select('*').eq('couple_code', coupleCode).order('created_at', { ascending: true });
        if (error) throw error;
        
        const himGrid = document.getElementById('letters-from-him-grid');
        const herGrid = document.getElementById('letters-from-her-grid');
        
        if (himGrid) himGrid.innerHTML = '';
        if (herGrid) herGrid.innerHTML = '';
        
        lettersData = {};
        
        let himCount = 0;
        let herCount = 0;
        
        data.forEach((letRow) => {
            let decrypted = null;
            try {
                decrypted = decryptJson(letRow.encrypted_data, cryptoKey);
            } catch (e) {
                console.error("Error decrypting letter", e);
            }
            if (!decrypted) return;
            
            const salutation = decrypted.salutation || "";
            const body = decrypted.body || "";
            const signature = decrypted.signature || "";
            const writtenBy = letRow.written_by || "Shivam";
            const date = new Date(letRow.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            
            lettersData[letRow.id] = {
                salutation: salutation,
                body: body,
                signature: signature,
                date: date
            };
            
            const card = document.createElement('div');
            card.className = 'letter-preview-card glass-card';
            card.onclick = () => openFullLetter(letRow.id);
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = body;
            const plainText = tempDiv.textContent || tempDiv.innerText || "";
            const snippet = plainText.length > 70 ? plainText.substring(0, 70) + '...' : plainText;
            
            card.innerHTML = `
                <span class="letter-badge">${date}</span>
                <h3 class="letter-preview-title">${salutation}</h3>
                <p class="letter-preview-snippet">${snippet}</p>
                <span class="letter-read-more">
                    <span>Read Letter</span>
                    <i data-lucide="arrow-right"></i>
                </span>
            `;
            
            if (writtenBy.toLowerCase() === 'shivam') {
                if (himGrid) himGrid.appendChild(card);
                himCount++;
            } else {
                if (herGrid) herGrid.appendChild(card);
                herCount++;
            }
        });
        
        if (himCount === 0 && himGrid) {
            himGrid.innerHTML = `
                <div class="empty-tab-placeholder">
                    <i data-lucide="mail" class="placeholder-icon"></i>
                    <p>No letters written yet. Be the first! ✉️</p>
                </div>
            `;
        }
        if (herCount === 0 && herGrid) {
            herGrid.innerHTML = `
                <div class="empty-tab-placeholder">
                    <i data-lucide="mail" class="placeholder-icon"></i>
                    <p>No letters written yet. Be the first! ✉️</p>
                </div>
            `;
        }
        
        lucide.createIcons();
    } catch (err) {
        console.error("Error loading letters:", err);
    }
}

async function handleLetterSubmit(event) {
    event.preventDefault();
    const salutationInput = document.getElementById('letter-salutation-input');
    const bodyInput = document.getElementById('letter-body-input');
    const signatureInput = document.getElementById('letter-signature-input');
    
    if (!salutationInput || !bodyInput || !signatureInput) return;
    
    const salutation = salutationInput.value.trim();
    const body = bodyInput.value.trim();
    const signature = signatureInput.value.trim();
    
    if (!salutation || !body || !signature) {
        alert("Please fill in all letter fields!");
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending...</span><i class="btn-icon spinner"></i>';
    
    try {
        const formattedBody = `<p>${body.replace(/\n/g, '</p><p>')}</p>`;
        
        const encryptedData = encryptJson({
            salutation: salutation,
            body: formattedBody,
            signature: signature
        }, cryptoKey);
        
        const currentUser = localStorage.getItem('current_user') || 'Shivam';
        
        const { error } = await supabase.from('letters').insert({
            encrypted_data: encryptedData,
            written_by: currentUser,
            couple_code: coupleCode
        });
        
        if (error) throw error;
        
        event.target.reset();
        closeModal('write-letter-modal');
        await loadLetters();
        alert("Letter sent successfully! ✉️❤️");
    } catch (err) {
        console.error("Failed sending letter:", err);
        alert("Error sending letter. Try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// --- Reasons (Why I Love You) Management ---

async function loadReasons() {
    try {
        const { data, error } = await supabase.from('reasons').select('*').eq('couple_code', coupleCode).order('created_at', { ascending: true });
        if (error) throw error;
        
        const hisList = document.getElementById('reasons-his-list');
        const herList = document.getElementById('reasons-her-list');
        
        if (hisList) hisList.innerHTML = '';
        if (herList) herList.innerHTML = '';
        
        let hisCount = 0;
        let herCount = 0;
        
        data.forEach((reasonRow) => {
            let decryptedText = "";
            try {
                decryptedText = decryptText(reasonRow.encrypted_data, cryptoKey);
            } catch (e) {
                console.error("Error decrypting reason", e);
            }
            if (!decryptedText) return;
            
            const writtenBy = reasonRow.written_by || "Shivam";
            
            const li = document.createElement('li');
            li.className = 'reason-item glass-card';
            li.innerHTML = `
                <div class="reason-icon">
                    <i data-lucide="heart"></i>
                </div>
                <p class="reason-text">${decryptedText}</p>
            `;
            
            if (writtenBy.toLowerCase() === 'shivam') {
                if (hisList) hisList.appendChild(li);
                hisCount++;
            } else {
                if (herList) herList.appendChild(li);
                herCount++;
            }
        });
        
        if (hisCount === 0 && hisList) {
            hisList.innerHTML = `
                <div class="empty-tab-placeholder" style="grid-column: 1 / -1;">
                    <i data-lucide="heart" class="placeholder-icon"></i>
                    <p>No reasons added yet. Add the first one! ❤️</p>
                </div>
            `;
        }
        if (herCount === 0 && herList) {
            herList.innerHTML = `
                <div class="empty-tab-placeholder" style="grid-column: 1 / -1;">
                    <i data-lucide="heart" class="placeholder-icon"></i>
                    <p>No reasons added yet. Add the first one! ❤️</p>
                </div>
            `;
        }
        
        lucide.createIcons();
        
        const hisPanel = document.getElementById('reasons-his');
        const herPanel = document.getElementById('reasons-her');
        if ((hisPanel && hisPanel.classList.contains('active')) || (herPanel && herPanel.classList.contains('active'))) {
            setTimeout(triggerReasonsAnimation, 50);
        }
    } catch (err) {
        console.error("Error loading reasons:", err);
    }
}

async function handleReasonSubmit(event) {
    event.preventDefault();
    const textInput = document.getElementById('reason-text-input');
    if (!textInput) return;
    
    const text = textInput.value.trim();
    if (!text) {
        alert("Please enter a reason!");
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving...</span><i class="btn-icon spinner"></i>';
    
    try {
        const encryptedData = encryptText(text, cryptoKey);
        const currentUser = localStorage.getItem('current_user') || 'Shivam';
        
        const { error } = await supabase.from('reasons').insert({
            encrypted_data: encryptedData,
            written_by: currentUser,
            couple_code: coupleCode
        });
        
        if (error) throw error;
        
        event.target.reset();
        closeModal('add-reason-modal');
        await loadReasons();
        alert("Reason added successfully! ❤️");
    } catch (err) {
        console.error("Failed saving reason:", err);
        alert("Error saving reason. Try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// --- Modal Handlers ---

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Bind globals for inline onclick / onsubmit attributes
window.selectSetupRole = selectSetupRole;
window.handleSetupSubmit = handleSetupSubmit;
window.handleMemorySubmit = handleMemorySubmit;
window.handleSongSubmit = handleSongSubmit;
window.handleLetterSubmit = handleLetterSubmit;
window.handleReasonSubmit = handleReasonSubmit;
window.openModal = openModal;
window.closeModal = closeModal;
window.navigateTo = navigateTo;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.switchLettersTab = switchLettersTab;
window.switchReasonsTab = switchReasonsTab;
window.openFullLetter = openFullLetter;
window.closeFullLetter = closeFullLetter;
