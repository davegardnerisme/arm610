
function Mmu() {
    function Memory(arrayBuffer) {
        this.arrayBuffer = arrayBuffer;
        this.length      = arrayBuffer.byteLength;
        this.u8          = new Uint8Array(arrayBuffer);
        this.s32         = new Int32Array(arrayBuffer);
    }

    Memory.prototype = {
        // hard-coded for little-endian right now (least significant bit at lowest address)
        clear : function () {
            var i;
            for (i = 0; i < this.u8.length; ++i) {
                this.u8[i] = 0;
            }
        },
        readU32 : function (offset) {
            return ((this.u8[offset]) | (this.u8[offset+1] << 8) | (this.u8[offset+2] << 16) | this.u8[offset+3] << 24)>>>0;
        },
        readU16 : function (offset) {
            return (this.u8[offset])  | (this.u8[offset+1] << 8);
        },
        readU8  : function (offset) {
            return this.u8[offset];
        },

        readS32 : function (offset) {
            return ((this.u8[offset]) | (this.u8[offset+1] << 8) | (this.u8[offset+2] << 16) | this.u8[offset+3] << 24) | 0;
        },
        readS16 : function (offset) {
            return  ((this.u8[offset] << 16) | (this.u8[offset+1] << 24) ) >> 16;
        },
        readS8  : function (offset) {
            return  ((this.u8[offset] << 24) ) >> 24;
        },

        write32 : function (offset, value) {
            this.u8[offset  ] = value;
            this.u8[offset+1] = value >> 8;
            this.u8[offset+2] = value >> 16;
            this.u8[offset+3] = value >> 24;
        },

        write16 : function (offset,value) {
            this.u8[offset  ] = value;
            this.u8[offset+1] = value >> 8;
        },

        write8 : function (offset,value) {
            this.u8[offset] = value;
        },

        clearBits32 : function (offset, bits) {
            var value = this.readU32(offset) & ~bits;
            this.write32(offset, value);
            return value;
        },
        setBits32 : function (offset, bits) {
            var value = this.readU32(offset) | bits;
            this.write32(offset, value);
            return value;
        },
        getBits32 : function (offset, bits) {
            return this.readU32(offset) & bits;
        }
    };

    /**
     * Src/Dest are Memory(); offsets in bytes
     */
    function memoryCopy(dst, dstoff, src, srcoff, len) {
        var i;
        for (i = 0; i < len; ++i) {
            dst.u8[dstoff+i] = src.u8[srcoff+i];
        }
    }    
    
    // ---
    
    var ram             = new Memory(new ArrayBuffer(8*1024*1024));

    /* @todo these are just to get stuff working; i think the MMU interface should not have these */
    Mmu.prototype.write8 = function(addr, val) {
        ram.write8(addr, val & 0xF);
    }
    Mmu.prototype.write32 = function(addr, val) {
        ram.write32(addr, val & 0xFFFF);
    }
    Mmu.prototype.read8 = function(addr) {
        ram.readU8(addr);
    }
    Mmu.prototype.read32 = function(addr) {
        ram.readU32(addr);
    }
    
    /* @todo sort out the proper MMU interface below */

    Mmu.prototype.write = function(addr, val, opcode) {
        
    }
    
    Mmu.prototype.read = function(addr) {
    }
    
    Mmu.prototype.translateAddress = function(addr, rw, preFetch) {
        
    }
    
    Mmu.prototype.fetchInstruction = function(addr) {
        console.log("Fetch instruction " + addr);
        return ram.readU32(addr);
    }
    
    Mmu.prototype.inspect = function(addr) {
        return ram.readU32(addr);
    }
    
    Mmu.prototype.load = function(prog) {
        var progMem = new Memory(new ArrayBuffer(32*prog.length));
        for (var i=0; i<prog.length; i++) {
            progMem.write8(i*4,   prog[i]>>24);
            progMem.write8(i*4+1, prog[i]>>16);
            progMem.write8(i*4+2, prog[i]>>8);
            progMem.write8(i*4+3, prog[i]);
            //progMem.write32(i*4, prog[i]);
        }
        memoryCopy(ram, 0, progMem, 0, prog.length*4);
        console.log("Loaded " + prog.length + " instructions");
    }
}
