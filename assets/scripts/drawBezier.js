const Bezier = require('./bezier');

const Ident = {
    point: 0,
    control: 1,
    window: 2
}

cc.Class({
    extends: cc.Component,
    // editor: {
    //     executeInEditMode: true,
    // },

    properties: {
        graphicsNode: cc.Node,
        box: cc.Node,
        point: cc.Prefab,//坐标点
        control: cc.Prefab,//控制点
        bezierColor: cc.hexToColor('#03A8F3'),// 贝塞尔曲线颜色
        lineColor: cc.hexToColor('#e81e63'),//控制线段
        infoWindow: cc.Node,
        runTime: cc.EditBox,
        msg: cc.Node,
        timeInfo: cc.Label,
        deleteBtn: cc.Node,//删除按钮
    },

    onLoad() {
        this.init();
    },

    // 初始化
    init() {
        // 贝塞尔曲线列表
        this.bezierLists = [];
        // 曲线点列表
        this.bezierCurveData = {
            time: Number(this.runTime.string),//运行总时长
            length: 0,//曲线总长
            points: [],//曲线点列表
        }
        // 点 - 曲线 字典
        this.pointCurveDict = new Map();

        // 提示框
        this.infoWindow.zIndex = 10;
        this.notice = this.infoWindow.getChildByName("notice").getComponent(cc.Label);
        this.fileInputBox = this.infoWindow.getChildByName("Input").getChildByName("fileEditBox").getComponent(cc.EditBox);
        this.inputNode = this.node.getChildByName("Input");
        this.initGraphics();
        this.initRandCurve()
        this.initNodeEvents();
        this.saveBezierPath();
        this.hideInfoWindow();
        this.addDeleteBtnEvents();
    },

    update(dt) {
        this.drawBezierAll();
        if (this.isStartRun) {
            this.setCountTimeLabel(dt);
        }
        // let pos = this.getRandPos()
        // if (pos.x < -960) {
        //     console.error(pos)
        //     this.box.setPosition(pos)
        // }
        // console.log(this.getRandPos());
    },
    // 初始化Graphics
    initGraphics() {
        this.ctx = this.graphicsNode.getComponent(cc.Graphics);
        this.ctx.lineWidth = 2;
    },

    getRandPos() {
        // let screenSize = cc.view.getVisibleSize();
        let screenSize = cc.view.getDesignResolutionSize();
        let randX = Math.random() * screenSize.width - screenSize.width * 0.5;
        let randY = Math.random() * screenSize.height - screenSize.height * 0.5;
        return cc.v2(randX, randY)
    },
    // 初始化一个随机曲线
    initRandCurve() {
        let start = this.createPoint(Ident.point, this.getRandPos());
        let control = this.createPoint(Ident.control, this.getRandPos());
        let end = this.createPoint(Ident.point, this.getRandPos());
        this.moveTargetNode = null;
        let bezier = { start, control, end }
        this.bezierLists.push(bezier);
        this.saveToPointCurveDict(bezier);
    },
    // 
    initNodeEvents() {
        this.addTouchEvents(this.node);
        // 可移动的窗体
        // this.inputNode.ident = Ident.window;
        // this.addTouchEvents(this.inputNode);
    },

    // 绘制路线
    drawBezierAll() {
        this.ctx.clear();
        for (var i = 0, len = this.bezierLists.length; i < len; i++) {
            const curve = this.bezierLists[i];
            this.drawBezier(curve.start.position, curve.control.position, curve.end.position);
        }
    },
    // 绘制贝塞尔曲线
    drawBezier(startPos, controlPos, endPos) {
        //画笔移动到起始点
        this.ctx.moveTo(startPos.x, startPos.y);
        //线条颜色
        this.ctx.strokeColor = this.bezierColor;
        //绘制贝塞尔曲线
        this.ctx.quadraticCurveTo(controlPos.x, controlPos.y, endPos.x, endPos.y);
        this.ctx.stroke();
        //画笔移动到起始点
        this.ctx.moveTo(endPos.x, endPos.y);
        this.ctx.strokeColor = this.lineColor;
        //绘制直线
        this.ctx.lineTo(controlPos.x, controlPos.y);
        this.ctx.stroke();
        //
    },

    // 是否能移动
    isMove(node) {
        return node.ident == Ident.point || node.ident == Ident.control || node.ident == Ident.window;
    },
    // 是否能删除
    isDelete(node) {
        return node.ident == Ident.point;
    },

    // 添加节点事件
    addTouchEvents(node) {
        let _this = this;
        // 鼠标按下
        node.on(cc.Node.EventType.MOUSE_DOWN, function (event) {
            event.stopPropagation();
            //创建坐标点,需要先把屏幕坐标转换到节点坐标下
            let mousePos = _this.convertToNodeSpace(event);
            console.log(mousePos)

            // 鼠标右键
            if (event.getButton() == cc.Event.EventMouse.BUTTON_RIGHT) {
                if (_this.isDelete(this)) {
                    _this.deleteTarget = this;
                    _this.showDeleteBtn(mousePos);
                }
                console.log(this)
                return
            }

            if (!_this.isOperate()) {
                console.log(this)
                return
            }
            // 可以移动的节点
            if (_this.isMove(this)) {
                //指定需要移动的目标节点
                _this.moveTargetNode = this;
            }
            // 空白地方才创建新的
            if (!_this.isMove(this) && !_this.moveTargetNode) {
                //创建新的节点
                _this.createCurve(mousePos);
            }
            _this.isMouseDown = true;
        });
        // 鼠标移动
        node.on(cc.Node.EventType.MOUSE_MOVE, function (event) {
            //如果是目标节点
            if (_this.isMove(this)) {
                this.opacity = 100;
                cc._canvas.style.cursor = "all-scroll"
            }
            //创建坐标点,需要先把屏幕坐标转换到节点坐标下
            let mousePos = _this.convertToNodeSpace(event);
            //鼠标按下并且有指定目标节点
            if (_this.isMouseDown && _this.moveTargetNode) {
                _this.moveTargetNode.setPosition(mousePos);
            }
        });
        // 鼠标离开
        node.on(cc.Node.EventType.MOUSE_LEAVE, function (event) {
            //如果是目标节点
            if (_this.isMove(this)) {
                this.opacity = 255;
                cc._canvas.style.cursor = "auto"
            }
        });
        // 鼠标抬起
        node.on(cc.Node.EventType.MOUSE_UP, function (event) {
            _this.isMouseDown = false;
            _this.moveTargetNode = null;
            if (_this.isMove(this)) {
                _this.saveBezierPath();//保存坐标点
            }
        });
    },

    // 创建新节点
    createPoint(ident, pos) {
        let node;
        if (ident == Ident.point) {
            node = cc.instantiate(this.point);
            node.ident = Ident.point;
            node.name = "point";
        } else if (ident == Ident.control) {
            node = cc.instantiate(this.control);
            node.ident = Ident.control;
            node.name = "control";
            this.moveTargetNode = node;
        }
        node.parent = this.node;
        node.setPosition(pos);
        this.addTouchEvents(node);
        return node
    },

    // 创建新曲线
    createCurve(pos) {
        let point = this.createPoint(Ident.point, pos);
        let control = this.createPoint(Ident.control, pos);
        // 把曲线列表最后一个点作为新曲线起点
        let start = this.bezierLists[this.bezierLists.length - 1].end;
        let curve = {
            start: start,
            control: control,
            end: point,
        }
        this.bezierLists.push(curve);
        this.saveToPointCurveDict(curve);
        console.log("bezierLists->", this.bezierLists)
    },

    // 存储到曲线字典
    saveToPointCurveDict(curve) {
        let obj;
        for (const key in curve) {
            const point = curve[key];
            if (this.pointCurveDict.has(point)) {
                obj = this.pointCurveDict.get(point);
            } else {
                obj = {};
            }
            obj[key] = curve;
            this.pointCurveDict.set(point, obj);
        }
        console.log("pointCurveDict", this.pointCurveDict);
    },

    // 屏幕坐标转换到节点坐标
    convertToNodeSpace(event) {
        return this.node.convertToNodeSpaceAR(event.getLocation());
    },
    // ------------------------【删除节点】---------------------------
    addDeleteBtnEvents() {
        this.deleteBtn.on(cc.Node.EventType.MOUSE_DOWN, (event) => {
            event.stopPropagation();
            if (event.getButton() == cc.Event.EventMouse.BUTTON_LEFT) {
                if (this.bezierLists.length <= 1) {
                    this.showMsg("不能删除最后一个曲线!!");
                    return;
                }
                this.deletePoint();
                this.hideDeleteBtn();
                // 重新保存下路径
                this.saveBezierPath();
                console.log("删除节点bezierLists->", this.bezierLists)
                console.log("删除节点pointCurveDict->", this.pointCurveDict)
            }
        })
    },
    // 判断该点是起点,终点或者中间点
    getPointLocation(node) {
        let curveObj = this.pointCurveDict.get(node);
        if (curveObj) {
            if (curveObj["start"] && curveObj["end"]) {
                return "center";
            }
            if (curveObj["start"]) {
                return "start";
            }
            if (curveObj["end"]) {
                return "end";
            }
        }
        return 0;
    },
    // 删除节点
    deletePoint() {
        if (this.pointCurveDict.has(this.deleteTarget)) {
            let location = this.getPointLocation(this.deleteTarget)
            if (location == "center") {
                this.deleteCenterPoint(this.deleteTarget);
            } else if (location == "start") {
                this.deleteStartPoint(this.deleteTarget);
            } else if (location == "end") {
                this.deleteEndPoint(this.deleteTarget);
            }
        }
    },
    // 删除的是中间点
    deleteCenterPoint(point) {
        console.warn("删除的是中间点");

        if (this.pointCurveDict.has(point)) {
            //中间点有前后两个曲线,删除该点就需要合并两个曲线
            let CurveObj = this.pointCurveDict.get(point);
            let prevCurve = CurveObj.end;
            let nextCurve = CurveObj.start;
            // 把前一个曲线的终点移动到后一个曲线的终点上
            prevCurve.end = nextCurve.end;
            CurveObj.end = prevCurve;
            CurveObj.start = null;
            this.pointCurveDict.set(prevCurve.end, CurveObj);
            // 删除后曲线相关的信息
            this.pointCurveDict.delete(nextCurve.start)
            this.pointCurveDict.delete(nextCurve.control)
            nextCurve.start.destroy();
            nextCurve.control.destroy();
            for (var i = 0, len = this.bezierLists.length; i < len; i++) {
                const curve = this.bezierLists[i];
                if (nextCurve === curve) {
                    this.bezierLists.splice(i, 1);
                    return
                }
            }
        }
    },
    // 删除的是起点
    deleteStartPoint(point) {
        console.warn("删除的是起点");

        if (this.pointCurveDict.has(point)) {
            let CurveObj = this.pointCurveDict.get(point);
            let startCurve = CurveObj.start;
            CurveObj.end = null;
            // 删除曲线
            this.pointCurveDict.delete(startCurve.start)
            this.pointCurveDict.delete(startCurve.control)
            startCurve.start.destroy();
            startCurve.control.destroy();
            for (var i = 0, len = this.bezierLists.length; i < len; i++) {
                const curve = this.bezierLists[i];
                if (startCurve === curve) {
                    this.bezierLists.splice(i, 1);
                    return
                }
            }
        }
    },
    // 删除的是终点
    deleteEndPoint(point) {
        console.warn("删除的是终点");

        if (this.pointCurveDict.has(point)) {
            let CurveObj = this.pointCurveDict.get(point);
            let endCurve = CurveObj.end;
            CurveObj.start = null;
            // 删除曲线
            this.pointCurveDict.delete(endCurve.end)
            this.pointCurveDict.delete(endCurve.control)
            endCurve.end.destroy();
            endCurve.control.destroy();
            for (var i = 0, len = this.bezierLists.length; i < len; i++) {
                const curve = this.bezierLists[i];
                if (endCurve === curve) {
                    this.bezierLists.splice(i, 1);
                    return
                }
            }
        }
    },

    // ------------------------【保存】---------------------------
    // 保存路径
    saveBezierPath() {
        this.bezierCurveData.length = 0;
        this.bezierCurveData.points = [];
        console.log("保存路径bezierLists", this.bezierLists);
        for (var i = 0, len = this.bezierLists.length; i < len; i++) {
            const bezier = this.bezierLists[i];
            // 创建一个贝塞尔曲线
            let bezierCurve = new Bezier(bezier.start, bezier.control, bezier.end, 100);
            // 获取曲线点
            let points = bezierCurve.getPoints(100);
            // 获取曲线长度
            let curveLength = bezierCurve.getCurveLength();
            // 计算路程长度
            this.bezierCurveData.length += curveLength;
            // 存储曲线点
            this.bezierCurveData.points.push(...points);
            // console.log("points", points);
        }
        console.log("保存路径bezierCurveData", this.bezierCurveData);
        console.log("保存路径pointCurveDict->", this.pointCurveDict)
    },
    // save按钮
    save() {
        if (this.fileInputBox.string == "") {
            this.setNoitce("文件名不能为空!");
            return
        }
        if (!this.checkRunTimeInputBox()) {
            this.showMsg("运行时间只能填写数字！！！")
            return
        }
        this.setNoitce('');
        this.computeBezierActions();
        this.saveBezierPathToJson(this.fileInputBox.string);
    },

    //保存为json数据
    saveBezierPathToJson(name) {
        if (cc.sys.isBrowser) {
            let datas = JSON.stringify(this.bezierCurveData);
            var textFileAsBlob = new Blob([datas], { type: 'application/json' });
            var downloadLink = document.createElement("a");
            downloadLink.download = name;
            downloadLink.innerHTML = "Download File";
            if (window.webkitURL != null) {
                // Chrome允许点击链接
                //而无需实际将其添加到DOM中。
                downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
            }
            else {
                //在点击之前 Firefox要求将链接添加到DOM中
                downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
                downloadLink.onclick = destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        }
    },
    computeBezierActions() {
        this.actionLists = [];
        // 创建动作队列
        for (var i = 0, len = this.bezierCurveData.points.length; i < len; i++) {
            const point = this.bezierCurveData.points[i];
            //计算当前路段需要的时间
            let time = point.length / this.bezierCurveData.length * this.bezierCurveData.time;
            point.time = time;
            // 创建动作
            let action = cc.moveTo(time, cc.v2(point.x, point.y));
            this.actionLists.push(action);
        }
    },

    // 开始播放移动动画
    playMoveAnimation() {
        // 设置初始位置
        // this.box.setPosition(this.bezierLists[0].start);
        // 计算动作队列
        this.computeBezierActions();
        // 开始计时
        this.startCountTime();
        console.time("time")
        this.actionLists.push(cc.callFunc(() => {
            this.stopCountTime();
            console.timeEnd("time")

        }))
        if (this.actionLists.length > 1) {
            this.box.runAction(cc.sequence(this.actionLists));
        } else {
            this.box.runAction(...this.actionLists);
        }
    },

    checkRunTimeInputBox() {
        if (this.runTime.string == "" || isNaN(Number(this.runTime.string))) {
            return false
        }
        return true
    },
    // 设置运行时间
    setRunTime() {
        this.bezierCurveData.time = Number(this.runTime.string);
    },

    // 播放动画
    play() {
        if (!this.checkRunTimeInputBox()) {
            this.showMsg("运行时间只能填写数字！！！")
            return
        }
        this.playMoveAnimation()
        // 
        // this.box.setPosition(this.bezier.startPos);
        // cocos 贝塞尔曲线运动
        // this.box_y.setPosition(this.bezier.startPos);
        // this.box_y.runAction(cc.bezierTo(this.runTime, [this.bezier.startPos, this.bezier.controlPos, this.bezier.endPos]))
    },

    // ------------------------【弹窗设置相关】---------------------------
    showInfoWindow() {
        this.infoWindow.active = true;
        this.setNoitce('');
    },
    hideInfoWindow() {
        this.infoWindow.active = false;
    },
    setNoitce(str) {
        this.notice.string = str;
    },
    showMsg(msg) {
        this.msg.active = true;
        this.msg.getComponent(cc.Label).string = msg
        setTimeout(() => {
            if (this.msg) {
                this.msg.active = false;
            }
        }, 1000);
    },
    // 开始计时
    startCountTime() {
        this.isStartRun = true;
        this.timeInfo.string = 0;
        this.currentRunTime = 0;
    },
    stopCountTime() {
        this.isStartRun = false;
    },
    setCountTimeLabel(dt) {
        this.currentRunTime = this.currentRunTime + dt;
        this.timeInfo.string = "run time: " + this.currentRunTime.toFixed(2) + "s";
    },
    // 判断是否可以操作
    isOperate() {
        // 删除按钮还在 , 不能操作
        if (this.deleteBtn.active) {
            this.hideDeleteBtn();
            return false;
        }
        return true;
    },

    // 显示删除按钮
    showDeleteBtn(pos) {
        this.deleteBtn.active = true;
        this.deleteBtn.setPosition(pos);
    },
    hideDeleteBtn() {
        this.deleteBtn.active = false;
    },


});
