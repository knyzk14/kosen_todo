const background = document.querySelector('.tab-background');
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.tab-pane');

const updateBackground = (activeTab) => {
    if (!activeTab) return;
    const tabLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;

    background.style.left = `${tabLeft}px`;
    background.style.width = `${tabWidth}px`;
};

document.addEventListener('DOMContentLoaded', () => {
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {

            tabs.forEach(t => t.classList.remove('active'));
            const clickedTab = e.target;
            clickedTab.classList.add('active');

            updateBackground(clickedTab);

            const targetId = clickedTab.getAttribute('data-target');
            panes.forEach(pane => {
                if (pane.id === targetId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });
});

window.addEventListener('load', () => {
    const active = document.querySelector('.tab.active');
    setTimeout(() => {
        updateBackground(active);
    }, 1000);
});

window.addEventListener('resize', () => {
    const currentActive = document.querySelector('.tab.active');
    updateBackground(currentActive);
});