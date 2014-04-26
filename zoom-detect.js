/**
 * 针对网页 放大或缩 小的检测
 *
 * @homepage    http://www.baidufe.com/component/zoom-detect/index.html
 * @author      zhaoxianlie
 */
var WebpageZoomDetect = (function(){

    "use strict";

    /**
     * 缩放检测，获取放大比例
     * @type {*}
     */
    var ZoomDetect = (function(){
        /**
         * 是否支持当前浏览器的缩放检测
         * @type {Boolean}
         * @private
         */
        var _isSupport = true;

        /**
         * IE8+ 下检测页面缩放比例
         * @return {Number}
         */
        var ie8plus = function(){
            return Math.round((screen.deviceXDPI / screen.logicalXDPI) * 100) / 100;
        };

        /**
         * IE10+ 下检测页面缩放比例
         * @return {Number}
         */
        var ie10plus = function () {
            return Math.round((document.documentElement.offsetHeight / window.innerHeight) * 100) / 100;
        };

        /**
         * 标准浏览器 下检测页面缩放比例
         * @return {Number}
         */
        var standard = function () {
            var zoom = window.top.outerWidth / window.top.innerWidth;
            return Math.round(zoom * 100) / 100;
        };

        /**
         * 通过css检测显示比例
         * @param ratio
         * @return {Boolean}
         */
        var wzdMatchMedia = function(ratio){
            var cssRule = [
                '.-wzd-zoomdetect {',
                    'text-decoration: none',
                '}',
                '@media only screen and (-o-min-device-pixel-ratio: ',ratio,'/1),',
                    'only screen and (min--moz-device-pixel-ratio: ',ratio,'), ',
                    'only screen and (-webkit-min-device-pixel-ratio: ',ratio,'), ',
                    'only screen and (min-resolution: 240dpi), ',
                    'only screen and (min-resolution: 2dppx) {',
                        '.-wzd-zoomdetect {',
                            'text-decoration: underline',
                        '}',
                '}'
            ].join('');

            var style, div, match = false;
            try{
                div = $('<div>a</div>').hide().addClass('-wzd-zoomdetect').appendTo('body');
                style = $('<style type="text/css">' + cssRule + '</style>');
                style.insertBefore(div);
                match = div.css('text-decoration') == 'underline';
                div.remove();
                style.remove();
            }catch(err){
            }

            return match;
        };

        /**
         * 在Firefox中，通过二分查找法来比对缩放比例
         * @return {Number}
         */
        var firefox = function(){
            // 精度
            var epsilon = 0.01;
            var binarySearch = function(minRatio,maxRatio,repeatTime){
                var midRatio = (minRatio + maxRatio) / 2;
                if (repeatTime <= 0 || maxRatio - minRatio < epsilon) {
                    return midRatio;
                }
                if (wzdMatchMedia(midRatio)) {
                    return binarySearch(midRatio, maxRatio, repeatTime - 1);
                } else {
                    return binarySearch(minRatio, midRatio, repeatTime - 1);
                }
            };
            return binarySearch(0,5,10);
        };

        /**
         * 缓存起来，避免每次都检测
         * @type {Object}
         * @private
         */
        var _retinaInfo = {
            detected : false,
            retina : false
        };

        /**
         * 判断当前屏幕是否为Retina屏
         */
        var isRetina = function(){
            if(_retinaInfo.detected) {
                return _retinaInfo.retina;
            }

            _retinaInfo = {
                detected: true,
                retina : wzdMatchMedia(2)
            };

            return _retinaInfo.retina;
        };

        /**
         * 执行检测，获取缩放比例
         * @private
         */
        var detect = function () {
            var ratio = 1;
            var ua = navigator.userAgent.toLowerCase();

            // IE8+
            if (!isNaN(screen.logicalXDPI) && !isNaN(screen.systemXDPI)) {
                ratio = ie8plus();
            }
            // IE10+ / Touch
            else if (window.navigator.msMaxTouchPoints) {
                ratio = ie10plus();
            }
            // WebKit 或者 Opera
            else if (/webkit/i.test(ua) || /opera/i.test(ua)) {
                ratio = standard();
            }
            // Firefox单独处理
            else if (/firefox/i.test(ua)) {
                if(isRetina()) {
                    ratio = 1;
                    // 不支持当前Retina屏幕下的FF
                    _isSupport = false;
                }else{
                    ratio = firefox();
                }
            }
            // 其他情况
            else if(parseInt(window.top.outerWidth,10)) {
                ratio = standard();
            }else{
                // 不支持当前浏览器的网页缩放检测
                _isSupport = false;
            }

            return ratio;
        };

        /**
         * 判断组件是否支持当前浏览器的网页缩放检测
         * @return {Boolean}
         */
        var support = function(){
            detect();
            return _isSupport;
        };

        return {
            support : support,
            detect : detect
        };
    })();

    /**
     * cookie操作的简单类
     * @type {Object}
     */
    var CookieHandler = {
        // 获取cookie
        get : function(key) {
            var reg = new RegExp("(^| )" + key + "=([^;\/]*)([^;\x24]*)(;|\x24)");
            var result = reg.exec(document.cookie);

            return result ? (result[2] || null) : null;
        },

        // 设置cookie
        set : function(config) {
            // 设置cookie过期时间：半年
            var expires = new Date();
            expires.setTime(expires.getTime() + 86400000*183);

            document.cookie = config.key + "=" + config.value
                + (config.path ? "; path=" + (config.path == './' ? '' : config.path) : "/")
                + ( expires ? "; expires=" + expires.toGMTString() : "")
                + (config.domain ? "; domain=" + config.domain : "")
                + (config.secure ? "; secure" : '');
        }
    };

    var _intervalId;
    var _running = false;

    /**
     * 检测一次
     * @private
     */
    var _detect = function(){
        var _html = [
            '<div class="mod-zoomdetect">',
                '<a href="#" class="wzd-btnclose" title="关闭">关闭</a>',
                '<div>',
                    '<span class="wzd-txt">#text#</span>',
                    '<a href="#" class="wzd-nevertip" title="永久不再提示">不再提示</a>',
                '</div>',
            '</div><div></div>'
        ].join('');
        var text = '';

        // 获取页面的缩放比例
        var _ratio = ZoomDetect.detect();
        // 由于窗口为非最大化的情况下，会出现检测错误，所以需要加上一个误差修正值
        _ratio = _ratio < 0.95 ? _ratio : (_ratio > 1.05 ? _ratio : 1);
        if(_ratio == 1) {
            // 页面正常
            text = '您的浏览器目前处于正常比例！'
        }else{
            // 页面不正常
            var tip = _ratio > 1 ? '放大' : '缩小';
            var controlKey = (navigator.platform.toLowerCase().indexOf('mac') > -1) ? 'command' : 'Ctrl';
            text = '您的浏览器处于<q class="x-tip">' + tip + '</q>状态，' + tip
                + '比例为' + String(_ratio * 100).substr(0,6) + '%，'
                + '将会导致显示不正常，您可以用键盘按<q class="x-key">' + controlKey
                + '+数字0</q>恢复正常比例。'
        }

        var elBanner = $('.mod-zoomdetect');
        var btnClose = $('.mod-zoomdetect .wzd-close');
        if(!elBanner[0]) {
            // 插入节点：显示
            elBanner = $(_html.replace('#text#',text)).prependTo('body').attr('data-ratio',_ratio).hide();
            // 关闭按钮 / 不再提示
            elBanner.find('.wzd-btnclose,.wzd-nevertip').click(function(e){
                elBanner.slideUp(200);
                if(_intervalId != undefined) {
                    _stop();
                }
                // 不再提示
                if($(this).hasClass('wzd-nevertip')) {
                    CookieHandler.set({
                        key : '_wzd_nevertip_',
                        value : 1
                    });
                }
                e.stopPropagation();
                e.preventDefault();
            });
        }else{
            var _preRatio = parseFloat(elBanner.attr('data-ratio'),10);
            // 更新显示文案
            if(_preRatio != _ratio) {
                elBanner.attr('data-ratio',_ratio).find('.wzd-txt').html(text);
            }
        }
        if(_ratio == 1) {
            elBanner.slideUp(200);
        }else{
            elBanner.slideDown(200);
        }
    };

    /**
     * 网页缩放检测
     * @param       {Object}    configs    用于页面缩放检测的配置项
     * @p-config    {Boolean}   always     总是在后台进行页面缩放检测：每隔一段时间自动检测一次
     *                                      默认：true，设置为false时表示只检测一次
     * @p-config    {Integer}   interval   自动检测的时间间隔，默认：500ms
     */
    var _start = function(configs){
        configs = configs || {};

        // 如果程序正在运行，就不用再启动了
        if(_running) return ;
        _running = true;

        // 首先检测当前浏览器是否支持
        if(ZoomDetect.support()) {
            if(configs.always != false) {
                if(!CookieHandler.get('_wzd_nevertip_')) {
                    _intervalId = window.setInterval(_detect,configs.interval || 500)
                }
            }else{
                _detect();
            }
            $(window).blur(function(e){
                _stop();
            }).focus(function(e){
                _start();
            });
        }
    };

    /**
     * 停止检测
     */
    var _stop = function(){
        if(_intervalId != undefined) {
            window.clearInterval(_intervalId);
            _running = false;
        }
    };


    return {
        version : '1.2',
        start : _start,
        stop : _stop
    };
})();