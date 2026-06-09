import { PlaybackState } from '../state/playbackState';

export function setupLocomotionControls(renderer: any) {
  let locoSpeed = 80;

  const locoAllBtns = () => document.querySelectorAll('.loco-btn');
  const locoSetActive = (id: string) => {
    locoAllBtns().forEach(b => b.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  };

  const locoGo = (dir: 'left' | 'right' | 'up' | 'down') => {
    if (!renderer) return;
    renderer.setLocomotion(dir, locoSpeed);
    locoSetActive('loco-' + dir);
    if (!PlaybackState.playing) {
      PlaybackState.playing = true;
      document.getElementById('btn-tl-play')?.classList.add('playing');
    }
  };

  document.getElementById('loco-left')?.addEventListener('click',  () => locoGo('left'));
  document.getElementById('loco-right')?.addEventListener('click', () => locoGo('right'));
  document.getElementById('loco-up')?.addEventListener('click',    () => locoGo('up'));
  document.getElementById('loco-down')?.addEventListener('click',  () => locoGo('down'));

  document.getElementById('loco-stop')?.addEventListener('click', () => {
    if (renderer) renderer.setLocomotion('none');
    locoSetActive('loco-stop');
  });

  document.getElementById('loco-walk')?.addEventListener('click', () => {
    locoSpeed = 80;
    document.querySelectorAll('.loco-speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('loco-walk')?.classList.add('active');
    if (renderer && renderer.getLocomotionDir() !== 'none') {
      renderer.setLocomotion(renderer.getLocomotionDir(), locoSpeed);
    }
  });

  document.getElementById('loco-run')?.addEventListener('click', () => {
    locoSpeed = 160;
    document.querySelectorAll('.loco-speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('loco-run')?.classList.add('active');
    if (renderer && renderer.getLocomotionDir() !== 'none') {
      renderer.setLocomotion(renderer.getLocomotionDir(), locoSpeed);
    }
  });
}
