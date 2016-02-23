window.addEventListener('load', function () {
	var graph = new GraphWidget($('.someClass')[0]);
    var data = {
        nodes:[]
    }
    var size = 150
    for(var i=0; i<size; i++) {
        data.nodes.push({
            data: {
                weight:500
            },
            connections: []
        });
    }

    for(var i=0; i<size; i++) { 
        var node = data.nodes[i];
        var conn =  node.connections;
        var connAm = getRandomInt(0,2);
        for(var j=conn.length; j <= connAm; j++) {
            var neighb = getRandomInt(0,size-1);
            var neighbNode = data.nodes[neighb];
            while(neighb == i || node.connections.indexOf(neighb) != -1 || neighbNode.connections.length >= 3) {
                neighb = getRandomInt(0,size-1);
                neighbNode = data.nodes[neighb];
            }
            node.connections.push(neighb);
            neighbNode.connections.push(i);

        }
    }
    graph.setData(data);
})

function getRandomInt(min, max)
{
  return Math.floor(Math.random() * (max - min + 1)) + min;

}


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

    function lookAtNode(node) {
        var pos = node.getMesh().position;
        camera.lookAt(pos);  
        var cPos = camera.position;
        var temp = cPos.clone();
        var distance = temp.length();
        temp.sub(pos);
        temp.normalize();
        var deltaD = 4000 - distance;
        cPos.x = cPos.x + temp.x*deltaD;
        cPos.y = cPos.y + temp.y*deltaD;
        cPos.z = cPos.z + temp.z*deltaD;
        temp = cPos.clone();
        distance = temp.length();
   
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
        lookAtNode(item.nodeObj);
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

        camera = new THREE.PerspectiveCamera( 75, element.clientWidth / element.clientHeight, 1, 100000 );
        camera.position.z = 4000;
        camera.position.y = 1000;

        setLights();

        processRawData();

        camera.position.x = -400;

        renderer = new THREE.WebGLRenderer();
        renderer.setSize( element.clientWidth,  element.clientHeight );

        $(element).append(renderer.domElement);
    }


    function definePositions(nodes) {
        if(!nodes || nodes.length == 0)
            return;
        nodes[0].x = 0; nodes[0].y = 0; nodes[0].z = 0;
        var side = 1000;
        var setted = [0];
        placeNeighbours(nodes, setted, 0);
        for(var i = 1; i < nodes.length; i++) {
            if(setted.indexOf(i) == -1) {
                var node = nodes[i];
                node.x = getRandomInt(-side, side);
                node.y = getRandomInt(-side, side);
                node.z = getRandomInt(-side, side);
                placeNeighbours(nodes, setted, i);
            }
        }
    }

    function oldPositions(nodes) {
        if(!nodes || nodes.length == 0)
            return;
        nodes[0].x = 0; nodes[0].y = 0; nodes[0].z = 0;
        var side = 1000;
        var setted = [0];
        for(var i = 1; i < nodes.length; i++) {
            var node = nodes[i];
            node.x = getRandomInt(-side, side);
            node.y = getRandomInt(-side, side);
            node.z = getRandomInt(-side, side);
        }
    }

    function placeNeighbours(nodes, setted, i) {
        var node = nodes[i];
        var side = 1000;
        var temp = [];
        for(var i = 0; i < node.connections.length; i++ ) {
            var connI = node.connections[i];
            if(setted.indexOf(connI) == -1) {
                var neighNode = nodes[connI] 
                setted.push(connI);
                neighNode.x = node.x + getRandomInt(-side, side);
                neighNode.y = node.y + getRandomInt(-side, side);
                neighNode.z = node.z + getRandomInt(-side, side);
                temp.push(connI);
            }
        }
        for(var i = 0; i < temp.length; i++ ) {
            placeNeighbours(nodes, setted, temp[i]);
        }
    }
    var connNumber = 0;
    function processRawData() {
        if(!data)
            return;
        var nNodes = data.nodes;
        definePositions(nNodes);
        $list = $(target).find('.GW-nodelist');
        for(key in nNodes) {

            var node = nNodes[key];
            connNumber += node.connections.length;
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

        var isCalm = false;
        while(!isCalm) {
            isCalm = true;
            var speeds = [];
            for(var i = 0; i < nodes.length; i++) {
                var ball1 = nodes[i].getMesh();
                var connect = ball1.nodeData.connections;
                var curSpeed = new THREE.Vector3(0, 0, 0);
                for(var j = 0; j < nodes.length; j++) {
                    var ball2 = nodes[j].getMesh();
                    if(i != j) {
                        var diff = ball1.position.clone().sub(ball2.position);
                        localSpeed(diff, connect.indexOf(j) != -1);
                        curSpeed.add(diff);
                    }
                }
                
                isCalm = recalcSpeed(curSpeed)
                speeds[i] = curSpeed;
            }

            if(!isCalm) {
                for(var i = 0; i < nodes.length; i++) {
                    var ball = nodes[i].getMesh();
                    ball.position.add(speeds[i]);
                }
            } 
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
        console.log(scene.children)
    }

    function recalcSpeed(speed) {
        console.log('number', connNumber)
        var scalSpeed = speed.length();
        var maxVal = 20 * connNumber/nodes.length;
        var maxSpeed = 500;
        speed.normalize();
        if(scalSpeed > maxVal)
            maxVal = scalSpeed;
        if(scalSpeed> 0.1*maxVal) {
            scalSpeed = maxSpeed - maxSpeed*(1 - scalSpeed/maxVal);
        } else
            scalSpeed = 0;
        speed.x *= scalSpeed;
        speed.y *= scalSpeed;
        speed.z *= scalSpeed;

        return scalSpeed == 0 ? true : false;
    }

    function localSpeed(speed, connected) {
        var scalSpeed = speed.length();
        var speedUpD = connected ? 5000 : 15000,
            calmTo = connected ? 10000 : 40000;
        speed.normalize();
        if(scalSpeed < speedUpD) {
            scalSpeed = 10 - 10*(scalSpeed/speedUpD);
        } else if(scalSpeed > speedUpD && scalSpeed < calmTo) {
            scalSpeed = 0;
        } else if(scalSpeed > calmTo) {
            var temp = (scalSpeed - calmTo);
            if(temp < 1) temp = 1;
            scalSpeed = -(30 - 30*1/temp);
        }
        speed.x *= scalSpeed;
        speed.y *= scalSpeed;
        speed.z *= scalSpeed;

        return scalSpeed == 0 ? true : false;

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


