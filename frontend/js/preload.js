document.addEventListener('DOMContentLoaded', () => {
    const html = '<div class="common-background"><img></div>';
    document.body.insertAdjacentHTML('afterbegin', html);
});

const initTheme = () => {
    const root = document.documentElement;

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        root.setAttribute('data-theme', savedTheme);
        return;
    }

    root.setAttribute('data-theme', 'light');
};

const toggleTheme = () => {
    const root = document.documentElement;

    root.classList.add('theme-transition');
    const currentTheme = root.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);


    setTimeout(() => {
        root.classList.remove('theme-transition');
    }, 300);
};

initTheme();