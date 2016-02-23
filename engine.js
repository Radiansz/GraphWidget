window.addEventListener('load', function () {
	var graph = new GraphWidget($('.someClass')[0]);
    graph.setData({
        nodes: [
            {
                x: -1500,
                y: 900,
                z: -300,
                connections: [1, 4]
            },
            {
                x: 900,
                y: -1500,
                z: 600,
                connections: [0, 2, 4]
            },
            {
                x: 100,
                y: -100,
                z: -300,
                connections: [1, 3]
            },
            {
                x: 900,
                y: 900,
                z: 900,
                connections: [2]
            },
            {
                x: -900,
                y: -900,
                z: 900,
                connections: [1, 0]
            }
        ]
    });
})


var mouse = new THREE.Vector2();


function GraphWidget(el) {
    var toAdd = $('<div class="GW-view"></div><div class="GW-control">'+
            '<div class="GW-nodelist"></div><div class="GW-nodedata"></div>' +
        '</div>');
    $(el).append(toAdd);
    delete toAdd;
    var target = el;
    var element = $(target).find('.GW-view')[0];
    var scene, camera, renderer;
    var geometry, material, mesh;
    var plain , plainmesh;
    var plainmaterial;
    var keymap = {};
    var balls = [];
    var nodes = [];
    var connections = {};
    var lastClicked;
    var data;
    var raycaster = new THREE.Raycaster();

    var oX = new THREE.Vector3(1, 0, 0),
        oY = new THREE.Vector3(0, 1, 0),
        oZ = new THREE.Vector3(0, 0, 1);


    var oldCoords;

    init();
    animate();

    document.addEventListener('keydown', function(event) {
        var which = event.which;


        switch(which) {
            case 37:
                camera.translateX(-100);
                break;
            case 38:
                camera.translateZ(-100);
                break;
            case 39:
                camera.translateX(100);
                break;
            case 40:
                camera.translateZ(100);
                break;
        }
    });
    element.addEventListener( 'click', onClick, false );
    element.addEventListener('mousedown', function(event) {
        var which = event.which;
        keymap[which] = true;
    });

    element.addEventListener('mouseup', function(event) {
        var which = event.which;
        keymap[which] = false;

        oldCoords = null;
    });

     element.addEventListener('mouseout', function(event) {
        var which = event.which;
        for( key in keymap) 
            keymap[key] = false;
        oldCoords = null;
    });

    element.addEventListener('mousemove', function(event) {
        if(keymap[2]) {
            if(oldCoords == null) {
                oldCoords = { x: event.clientX, y: event.clientY };
                return;
            }
            var nCoord = { x: event.clientX, y: event.clientY };

            camera.rotateOnAxis(oY, (oldCoords.x - nCoord.x)/500);
            camera.rotateOnAxis(oX, (oldCoords.y - nCoord.y)/500);

            oldCoords = nCoord;

        }
    })

    this.setData = function(newData) {
        data = newData;
        cleanScene();
        setLights();
        processRawData();
    }

    function lookAtNode() {
        
    }

    function onClick( event ) {

        // calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components
        var o = $(element).offset();
        mouse.x = ( (event.pageX - o.left) / (element.clientWidth) ) * 2 - 1;
        mouse.y = - ( (event.pageY - o.top) / (element.clientHeight) ) * 2 + 1; 
        raycaster.setFromCamera( mouse, camera );
        var intersects = raycaster.intersectObjects( scene.children );
        for ( var i = 0; i < intersects.length; i++ ) {
            if(lastClicked) {
                lastClicked.getMesh().material.color.set( 0x0f0fff );
            }
            if(intersects[i].object.mainObj instanceof Ball ) {
                intersects[ i ].object.material.color.set( 0xff0000 );
                lastClicked = intersects[i].object.mainObj;
            }
            setItemActive(lastClicked.getMesh().domElem);
            setItemData(lastClicked.getMesh().nodeData);
        }    
    }

    function onItemClick(event) {
        var item = event.currentTarget;
        if(lastClicked) {
            lastClicked.getMesh().material.color.set( 0x0f0fff );
        }
        item.nodeObj.getMesh().material.color.set( 0xff0000 );
        lastClicked = item.nodeObj;
        setItemActive(item);
        setItemData(item.nodeObj.getMesh().nodeData);
    }

    function setItemActive(item) {
        $(target).find('.GW-nodeitem-active').removeClass('GW-nodeitem-active');
        $(item).addClass('GW-nodeitem-active');
    }

    function setItemData(nodeData) {
        var obj = nodeData.obj;
        delete nodeData.obj;
        $(target).find('.GW-nodedata').text(JSON.stringify(nodeData));
        nodeData.obj = obj;
    }



    function init() {

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera( 75, element.clientWidth / element.clientHeight, 1, 10000 );
        camera.position.z = 4000;
        camera.position.y = 1000;

        setLights();

        processRawData();

        camera.position.x = -400;

        renderer = new THREE.WebGLRenderer();
        renderer.setSize( element.clientWidth,  element.clientHeight );

        $(element).append(renderer.domElement);
    }



    function processRawData() {
        if(!data)
            return;
        var nNodes = data.nodes;
        $list = $(target).find('.GW-nodelist');
        for(key in nNodes) {

            var node = nNodes[key];
            var ball = new Ball({x: node.x || 0, y: node.y || 0, z: node.z || 0}, 0x0f0fff);
            ball.getMesh().nodeData = node;
            ball.getMesh().mainObj = ball;
            node.obj = ball;
            nodes[nodes.length] = ball;
            scene.add(ball.getMesh());
            var item = $('<div class = "GW-nodeitem">'+ (node.name || 'unknown') +'</div>');
            item.on('click', onItemClick);
            item[0].nodeObj = ball;
            ball.getMesh().domElem = item[0];
            $(target).find('.GW-nodelist').append(item);

        }

        for(key in nNodes) {
            var node = nNodes[key];
            var nConn = node.connections;
            for(cKey in nConn) {

                var pid = nConn[cKey];
                if(connections['' + key + '-' + pid] ||
                    connections['' + cKey + '-' + pid])
                    continue;
                var ball1 = nodes[key],
                    ball2 = nodes[pid];
                var conn = new Connection(ball1, ball2);
                connections['' + key + '-'+ pid] = conn;
                scene.add(conn.getMesh());
            }
        }
        console.log(scene.children);

    }

    function setLights() {
        var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        directionalLight.position.set( 0, 100, 0 );
        scene.add( directionalLight );
        var light = new THREE.AmbientLight( 0x404040 ); // soft white light
        scene.add( light );
    }

    function cleanScene() {
        var children = scene.children;
        while(children.length != 0) {
            scene.remove(children[0]);
        }

    }


    function animate() {
        

        renderer.render( scene, camera );
        requestAnimationFrame(animate);
    }

    function update() {

    }

    function Ball(position, color) {
        var geometry = new THREE.SphereGeometry( 200, 12, 12 );
        var material =   new THREE.MeshLambertMaterial( { color: color || 0xeeeeee, shading: THREE.SmoothShading } );
        var mesh = new THREE.Mesh(geometry, material);
        this.acceleration = {x:0, y:0};
        this.speed = {x:0, y:0};
        this.mesh = mesh;
        mesh.position.x = position.x || 0;
        mesh.position.y = position.y || 0;
        mesh.position.z = position.z || 0;

        this.onUpdate;
        this.onKeyDown;
        var ball = this;
        

        function keyDown(event) {
            ball.onKeyDown && ball.onKeyDown.apply(ball, arguments);
        }



        this.getMesh = function() {
            return mesh;
        };

        this.update = function() {
            this.onUpdate && this.onUpdate.apply(ball, arguments);
            mesh.translateX(this.speed.x);


            
        }
    }

    function Connection(ball1, ball2, color) {
        var p1 = ball1.getMesh().position,
            p2 = ball2.getMesh().position;
        var temp = p1.clone();
        var height = temp.sub(p2).length();
        var geometry = new THREE.CylinderGeometry( 10, 10, height);
        var position = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
            z: (p1.z + p2.z) / 2
        };
        var curPos = new THREE.Vector3(position.x, position.y, position.z);
        curPos.sub(p1);

        var xAngle = curPos.angleTo(oX),
            yAngle = curPos.angleTo(oY),
            zAngle = curPos.angleTo(oZ);
        if(curPos.z < 0)
            xAngle = -xAngle;
        if(curPos.y < 0)
            zAngle = -zAngle
        var material =   new THREE.MeshLambertMaterial( { color: color || 0x0f0fff, shading: THREE.SmoothShading } );
        var mesh = new THREE.Mesh(geometry, material);
        var axis = oY.clone();
        axis.cross(curPos);
        axis.normalize();
        this.mesh = mesh;
        var PI2 = Math.PI/2;
        var DPI = Math.PI*2;

        mesh.rotateOnAxis(axis, yAngle);
        
        mesh.position.x = position.x || 0;
        mesh.position.y = position.y || 0;
        mesh.position.z = position.z || 0;

        this.onUpdate;
        this.onKeyDown;
        var connection = this;
        

        function keyDown(event) {
            ball.onKeyDown && ball.onKeyDown.apply(connection, arguments);
        }

        this.getMesh = function() {
            return mesh;
        };

        this.update = function() {
            this.onUpdate && this.onUpdate.apply(connection, arguments);
            mesh.translateX(this.speed.x);


            
        }
    }
}


