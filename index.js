
const today = new Date();
const options = { year: 'numeric', month: 'long', day: 'numeric' };
const formattedDate = today.toLocaleDateString('en-US', options);

document.getElementById('date').textContent = formattedDate;

function updateTime() {
  const now  = new Date();
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const formattedTime = now.toLocaleDateString('en-US', options);
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  document.getElementById('time').textContent = `${formattedTime}.${ms}`;
}

setInterval(updateTime, 100);

let cursor = document.getElementById('cursor-p');

document.addEventListener('mousemove', (e) => {
  let x = `${e.clientX}px`;
  let y = `${e.clientY}px`;
  if (e.target.className.includes('ico')) {
    // return;
    cursor.style.background = 'red'
  } else {
    cursor.style.background = 'black'
    console.log(e)
  }
  cursor.style.top = y;
  cursor.style.left = x;

  // let d = document.createElement('div');
  // d.className = 'cursor'
  // d.style.top = y;
  // d.style.left = x;
  // document.body.appendChild(d);
})

function getRandomColor() {
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  return `#${randomColor.padStart(6, '0')}`;
}

document.querySelectorAll('.app-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('backdrop').style.display = 'block';
    document.getElementById('loader').style.display = 'block';
    setTimeout(() => {
      window.location.href = link.href;
    }, 0);
  });
});