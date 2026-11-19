/**
 * Dynamic Krunker-style FPS Reticle.
 * Expands slightly during jumping and high-speed movement.
 */
export class Crosshair {
  private container: HTMLElement;
  private topBar: HTMLElement;
  private bottomBar: HTMLElement;
  private leftBar: HTMLElement;
  private rightBar: HTMLElement;
  private centerDot: HTMLElement;

  private baseGap = 5;
  private currentGap = 5;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'crosshair';
    this.container.style.position = 'absolute';
    this.container.style.top = '50%';
    this.container.style.left = '50%';
    this.container.style.transform = 'translate(-50%, -50%)';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '100';

    this.centerDot = document.createElement('div');
    this.styleBar(this.centerDot, 2, 2);
    this.centerDot.style.borderRadius = '50%';
    this.container.appendChild(this.centerDot);

    this.topBar = document.createElement('div');
    this.styleBar(this.topBar, 2, 8);
    this.container.appendChild(this.topBar);

    this.bottomBar = document.createElement('div');
    this.styleBar(this.bottomBar, 2, 8);
    this.container.appendChild(this.bottomBar);

    this.leftBar = document.createElement('div');
    this.styleBar(this.leftBar, 8, 2);
    this.container.appendChild(this.leftBar);

    this.rightBar = document.createElement('div');
    this.styleBar(this.rightBar, 8, 2);
    this.container.appendChild(this.rightBar);

    parent.appendChild(this.container);
    this.updateLayout(this.baseGap);
  }

  private styleBar(el: HTMLElement, width: number, height: number): void {
    el.style.position = 'absolute';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundColor = '#00ffcc';
    el.style.boxShadow = '0 0 4px rgba(0, 255, 204, 0.8), 0 0 1px #000';
    el.style.transform = 'translate(-50%, -50%)';
  }

  private updateLayout(gap: number): void {
    this.topBar.style.transform = `translate(-50%, calc(-50% - ${gap + 4}px))`;
    this.bottomBar.style.transform = `translate(-50%, calc(-50% + ${gap + 4}px))`;
    this.leftBar.style.transform = `translate(calc(-50% - ${gap + 4}px), -50%)`;
    this.rightBar.style.transform = `translate(calc(-50% + ${gap + 4}px), -50%)`;
  }

  public setColor(hex: string): void {
    const shadow = `0 0 5px ${hex}, 0 0 1px #000`;
    [this.centerDot, this.topBar, this.bottomBar, this.leftBar, this.rightBar].forEach((el) => {
      el.style.backgroundColor = hex;
      el.style.boxShadow = shadow;
    });
  }

  public setStyle(style: 'cross' | 'dot' | 'circle' | 'wide'): void {
    if (style === 'dot') {
      this.topBar.style.display = 'none';
      this.bottomBar.style.display = 'none';
      this.leftBar.style.display = 'none';
      this.rightBar.style.display = 'none';
      this.centerDot.style.display = 'block';
      this.centerDot.style.width = '4px';
      this.centerDot.style.height = '4px';
    } else if (style === 'circle') {
      this.topBar.style.display = 'block';
      this.bottomBar.style.display = 'block';
      this.leftBar.style.display = 'block';
      this.rightBar.style.display = 'block';
      this.centerDot.style.display = 'none';
      this.baseGap = 7;
    } else if (style === 'wide') {
      this.topBar.style.display = 'block';
      this.bottomBar.style.display = 'block';
      this.leftBar.style.display = 'block';
      this.rightBar.style.display = 'block';
      this.centerDot.style.display = 'block';
      this.baseGap = 9;
    } else {
      // Classic Cross
      this.topBar.style.display = 'block';
      this.bottomBar.style.display = 'block';
      this.leftBar.style.display = 'block';
      this.rightBar.style.display = 'block';
      this.centerDot.style.display = 'block';
      this.centerDot.style.width = '2px';
      this.centerDot.style.height = '2px';
      this.baseGap = 5;
    }
    this.updateLayout(this.currentGap);
  }

  public update(speed: number, isGrounded: boolean, dt: number): void {
    const targetGap = this.baseGap + (isGrounded ? speed * 0.4 : speed * 0.7 + 6);
    this.currentGap += (targetGap - this.currentGap) * Math.min(1, dt * 15);
    this.updateLayout(this.currentGap);
  }
}
