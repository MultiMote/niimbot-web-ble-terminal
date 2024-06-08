(() => {
    const SERVICE_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
    const CHARACTERISTIC_UUID = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

    const connectButton = document.querySelector('.connect');
    const disconnectButton = document.querySelector('.disconnect');
    const logArea = document.querySelector('.logger');
    const sendHexButton = document.querySelector('.send-hex');
    const hexInput = document.querySelector('.hex-command');

    let gattServer = null;
    let channel = null;

    const updateControls = (connected) => {
        if (connected) {
            connectButton.setAttribute("disabled", "");
            disconnectButton.removeAttribute("disabled");
            hexInput.removeAttribute("disabled");
            sendHexButton.removeAttribute("disabled");
        } else {
            disconnectButton.setAttribute("disabled", "");
            connectButton.removeAttribute("disabled");
            hexInput.setAttribute("disabled", "");
            sendHexButton.setAttribute("disabled", "");
        }
    }

    const bufToString = (buf) => {
        return new TextDecoder().decode(buf);
    }

    const bufToHex = (buf) => {
        let arr = [];

        if (buf instanceof DataView) {
            for (let i = 0; i < buf.byteLength; i++) {
                arr.push(buf.getUint8(i));
            }
        } else if (buf instanceof Uint8Array) {
            arr = Array.from(buf);
        }

        return arr.map(
            (i) => i.toString(16).padStart(2, "0").toUpperCase()
        ).join(" ");
    }

    const logger = (text) => {
        console.log(text);
        logArea.innerText += text + "\n";
        logArea.scrollTop = logArea.scrollHeight;
    };

    const onDisconnect = () => {
        updateControls(false);
        logger("Disconnected");
    };

    const onPacket = (dw) => {
        logger(`<< ${bufToHex(dw)}`);
        logger(`<S ${bufToString(dw)}`);
    };

    const disconnect = () => {
        if (gattServer !== null) {
            gattServer.disconnect();
            gattServer = null;
            channel = null;
        }
    };

    const connect = async () => {
        const options = {
            filters: [
                { namePrefix: "D" },
                { services: [SERVICE_UUID] }
            ]
        };
        const device = await navigator.bluetooth.requestDevice(options);

        if (device.gatt === undefined) {
            throw new Error("Packet response command is not defined");
        }

        const disconnectListener = () => {
            gattServer = null;
            channel = null;
            device.removeEventListener('gattserverdisconnected', disconnectListener);
            onDisconnect();
        }

        device.addEventListener('gattserverdisconnected', disconnectListener);

        const _gattServer = await device.gatt.connect();

        const service = await _gattServer.getPrimaryService(SERVICE_UUID);

        const _channel = await service.getCharacteristic(CHARACTERISTIC_UUID);

        _channel.addEventListener('characteristicvaluechanged', (event) => {
            onPacket(event.target.value);
        });

        await _channel.startNotifications();

        gattServer = _gattServer;
        channel = _channel;
    };

    connectButton.onclick = async () => {
        connectButton.setAttribute("disabled", "");

        try {
            await connect();
            logger("Connected");
        } catch (e) {
            alert(e);
        }
        updateControls(channel !== null);
    };

    disconnectButton.onclick = async () => {
        disconnect();
    };

    const sendHex = async () => {
        if (channel === null) {
            return
        }

        const value = document.querySelector('.hex-command').value;

        if (!value) {
            return;
        }

        const match = value.match(/[\da-f]{2}/gi);

        if (!match) {
            return;
        }

        const bytes = new Uint8Array(match.map((h) => {
            return parseInt(h, 16)
        }));

        logger(`>> ${bufToHex(bytes)}`);
        await channel.writeValueWithoutResponse(bytes);
    };

    hexInput.addEventListener("keypress", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await sendHex();
        }
    });

    sendHexButton.onclick = async () => {
        await sendHex();
    };
})()