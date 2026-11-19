/**
 * Dynamic Esports Hitmarker UI overlay.
 * Flashes white on normal hits, red on headshots.
 */
export class Hitmarker {
  private element: HTMLElement;
  private life = 0;
  private maxLife = 0.16;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'hitmarker';
    this.element.style.position = 'absolute';
    this.element.style.top = '50%';
    this.element.style.left = '50%';
    this.element.style.transform = 'translate(-50%, -50%) rotate(45deg)';
    this.element.style.width = '24px';
    this.element.style.height = '24px';
    this.element.style.pointerEvents = 'none';
    this.element.style.opacity = '0';
    this.element.style.zIndex = '120';
    this.element.style.transition = 'opacity 0.05s ease';

    // Build the 4 diagonal arms of the 'X'
    const top = document.createElement('div');
    this.styleTick(top, 2, 8);
    top.style.top = '0';
    top.style.left = '11px';

    const bottom = document.createElement('div');
    this.styleTick(bottom, 2, 8);
    bottom.style.bottom = '0';
    bottom.style.left = '11px';

    const left = document.createElement('div');
    this.styleTick(left, 8, 2);
    left.style.top = '11px';
    left.style.left = '0';

    const right = document.createElement('div');
    this.styleTick(right, 8, 2);
    right.style.top = '11px';
    right.style.right = '0';

    this.element.appendChild(top);
    this.element.appendChild(bottom);
    this.element.appendChild(left);
    this.element.appendChild(right);

    parent.appendChild(this.element);
  }

  private styleTick(el: HTMLElement, w: number, h: number): void {
    el.style.position = 'absolute';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.backgroundColor = '#ffffff';
    el.style.boxShadow = '0 0 4px rgba(255, 255, 255, 0.9)';
    el.className = 'hitmarker-tick';
  }

  public show(isHeadshot: boolean): void {
    this.life = this.maxLife;
    this.element.style.opacity = '1';

    const color = isHeadshot ? '#ff1744' : '#ffffff';
    const scale = isHeadshot ? 1.3 : 1.0;
    this.element.style.transform = `translate(-50%, -50%) rotate(45deg) scale(${scale})`;

    const ticks = this.element.querySelectorAll<HTMLElement>('.hitmarker-tick');
    ticks.forEach((t) => {
      t.style.backgroundColor = color;
      t.style.boxShadow = `0 0 6px ${color}`;
    });
  }

  public update(dt: number): void {
    if (this.life > 0) {
      this.life -= dt;
      this.element.style.opacity = Math.max(0, this.life / this.maxLife).toString();
    }
  }
}
