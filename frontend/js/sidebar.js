const background = document.querySelector('.tab-background');

const updateBackground = (activeTab) => {
        if (!activeTab) return;
        const tabLeft = activeTab.offsetLeft;
        const tabWidth = activeTab.offsetWidth;

        background.style.left = `${tabLeft}px`;
        background.style.width = `${tabWidth}px`;
    };


document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            const clickedTab = e.target;
            clickedTab.classList.add('active');

            updateBackground(clickedTab);
        });
    });
});

window.addEventListener('load', () => {
    const active = document.querySelector('.active');
    setTimeout(() => {
        updateBackground(active);
        console.log(active.offsetWidth, active.offsetLeft);
    }, 1000);
});

window.addEventListener('resize', () => {
    const currentActive = document.querySelector('.active');
    updateBackground(currentActive);
});