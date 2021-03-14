class Pistol extends WeaponObject{
    constructor(stage, player, position, spritesheet){
        super(stage, position, spritesheet, player);
        this.ammo += 25;
        this.id = 'ammo1';
        this.setImgPos(new Pair(7, 11));
        this.setMaxProj(1);
    }

    fire(){
        if(this.canFire){
            var projectile = new PistolBullet(this.stage, this.player, this.spritesheet);
            projectile.setOID(this.oid);
            this.numProj++;
            this.ammo--;
            this.updateFireStatus();

            this.stage.addActor(projectile);
        }
    }

    draw(context){
        if(!this.player){
            super.draw(context);
        } 
    }
}