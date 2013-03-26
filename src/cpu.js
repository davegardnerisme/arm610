/**
 * TODO
 * 
 *  - sort out CPSR/SPSR on mode change
 *  - basic fetch/execute cycle
 *  - proper "reset" code
 * 
 */

function Arm610() {
    var MODE_USR    = 0;
    var MODE_FIQ    = 1;
    var MODE_IRQ    = 2;
    var MODE_SVC    = 3;
    var MODE_ABT    = 7;
    var MODE_UND    = 11;
    
    var CPSR_V      = 0x10000000;
    var CPSR_C      = 0x20000000;
    var CPSR_Z      = 0x40000000;
    var CPSR_N      = 0x80000000;
    
    var R15_MASK    = 0xFFFFFFFC;
    
    // ---
    
    var instructionSet = {
        notImplemented  : function(instruction, cpu) {
            console.log("Instruction not implemented");
        },
        /* b, bl (branch, branch with link) */
        /* http://www.coranac.com/tonc/text/asm.htm#ssec-arm-cnd */
        /* Branch instructions contain a signed 2's complement 24 bit offset.
         * This is shifted left two bits, sign extended to 32 bits, and added
         * to the PC. The instruction can therefore specify a branch of
         * +/- 32Mbytes. The branch offset must take account of the prefetch
         * operation, which causes the PC to be 2 words (8 bytes) ahead of
         * the current instruction.
         */
        branch          : function(instruction, cpu) {
            // -4 since we increment PC after instruction so we have to account for that
            var offset = ((instruction << 8) >> 6) - 4;
            cpu.armRegs[15] = cpu.armRegs[15] + offset;
            cpu.fetched = null;
            cpu.decoded = null;
            cpu.fetchedAddr = null;
            cpu.decodedAddr = null;
            console.log('Branching to ' + cpu.armRegs[15]);
        },
        branchLink      : function(instruction, cpu) {
            // -4 since we increment PC after instruction so we have to account for that
            var offset = ((instruction << 8) >> 6) - 4;
            cpu.armRegs[14] = cpu.armRegs[15] - 4;
            cpu.armRegs[15] = cpu.armRegs[15] + offset;
            cpu.fetched = null;
            cpu.decoded = null;
            cpu.fetchedAddr = null;
            cpu.decodedAddr = null;
            console.log('Branching (with link) to ' + cpu.armRegs[15]);
        },
        dataOperation   : function(instruction, cpu) {
            console.log('Data operation...');

            // opcode
            var op = (instruction>>21) & 0xF;
            
            // first operand; always reg
            var rn = (instruction>>16) & 0xF;
            var val1 = rn == 15 ? cpu.armRegs[15] & R15_MASK : cpu.armRegs[rn];
            
            // second operand depends on immediate bit
            var immediate = instruction & 0x2000000;
            var set = instruction       & 0x0100000;
            var rd = (instruction>>12) & 0xF;
            var op2 = instruction & 0xFFF;
            var val2;
            if (immediate == 0) {
                // 2nd operand is a shifted register (Rm)
                var rm = rd & 0xF;
                val2 = cpu.armRegs[rm];
                var shiftType = rd & 0x60;
                var shiftAmount;
                if (rd & 0x10) {
                    // shift amount specified by register - specifically the
                    // bottom byte of said reg
                    var rs = rd >> 8 & 0xF;
                    shiftAmount = rs == 15 ? cpu.armRegs[15] & R15_MASK : cpu.armRegs[rs];
                    shiftAmount = shiftAmount & 0xF;
                } else {
                    // shift amount specified as 5 bit unsigned integer
                    shiftAmount = rd >> 7 & 0x1F;
                }
                switch (shiftType) {
                    case 0x0:   // logical shift left
                        val2 = val2 << shiftAmount;
                        break;
                    case 0x1:   // logical shift right
                        val2 = val2 >>> shiftAmount;
                        break;
                    case 0x2:   // arithmatic shift right
                        val2 = val2 >> shiftAmount;
                        break;
                    case 0x3:   // rotate right
                        val2 = val2 | (rm << 0xF);
                        val2 = val2 >> shiftAmount;
                        val2 = val2 & 0xF;
                        break;
                }
            } else {
                // 2nd operand is a rotated 8 bit immediate value
                var barrelShiftAmount = instruction >> 8 & 0xF;
                val2 = instruction & 0xFF;
                
                // @todo barrel shifting
            }
            
            var result;
            var carry = cpu.armRegs[16] & 0x20000000 > 0 ? 1 : 0;
            switch (op) {
                case 0x0: // AND - Rd:= Op1 AND Op2 
                    console.log('AND - Rd:= Op1 AND Op2');
                    result = val1 & val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x1: // EOR - Rd:= Op1 EOR Op2
                    console.log('EOR - Rd:= Op1 EOR Op2');
                    result = val1 ^ val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x2: // SUB - Rd:= Op1 - Op2
                    console.log('SUB - Rd:= Op1 - Op2');
                    result = val1 - val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x3: // RSB - Rd:= Op2 - Op1
                    console.log('RSB - Rd:= Op2 - Op1');
                    result = val2 & val1;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x4: // ADD - Rd:= Op1 + Op2
                    console.log('ADD - Rd:= Op1 + Op2');
                    console.log(val1 + ' + ' + val2 + ' = ' + result + ' --> store in rd= ' + rd);
                    result = val1 + val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x5: // ADC - Rd:= Op1 + Op2 + C
                    console.log('ADC - Rd:= Op1 + Op2 + C');
                    result = val1 + val2 + carry;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x6: // SBC - Rd:= Op1 - Op2 + C - 1
                    console.log('SBC - Rd:= Op1 - Op2 + C - 1');
                    result = val1 - val2 + carry - 1;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x7: // RSC - Rd:= Op2 - Op1 + C - 1
                    console.log('RSC - Rd:= Op2 - Op1 + C - 1');
                    result = val2 - val1 + carry - 1;
                    cpu.armRegs[rd] = result;
                    break;
                case 0x8: // TST - set condition codes on Op1 AND Op2
                    console.log('TST - set condition codes on Op1 AND Op2');
                    result = val1 & val2;
                    break;
                case 0x9: // TEQ - set condition codes on Op1 EOR Op2
                    console.log('TEQ - set condition codes on Op1 EOR Op2');
                    result = val1 ^ val2;
                    break;
                case 0xA: // CMP - set condition codes on Op1 - Op2
                    console.log('CMP - set condition codes on Op1 - Op2');
                    result = val1 - val2;
                    break;
                case 0xB: // CMN - set condition codes on Op1 + Op2
                    console.log('CMN - set condition codes on Op1 + Op2');
                    result = val1 + val2;
                    break;
                case 0xC: // ORR - Rd:= Op1 OR Op2
                    console.log('ORR - Rd:= Op1 OR Op2');
                    result = val1 | val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0xD: // MOV - Rd:= Op2
                    console.log('MOV - Rd:= Op2');
                    result = val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0xE: // BIC - Rd:= Op1 AND NOT Op2
                    console.log('BIC - Rd:= Op1 AND NOT Op2');
                    result = val1 & ~val2;
                    cpu.armRegs[rd] = result;
                    break;
                case 0xF: // MVN - Rd:= NOT Op2
                    console.log('MVN - Rd:= NOT Op2');
                    result = ~ val2;
                    cpu.armRegs[rd] = result;
                    break;
            }
            
            console.log(val1 + ', ' + val2 + ' => ' + result + ' rd = ' + rd);
            
            // store PSR?
            if (set > 0) {
                console.log('Setting CPSR for result ' + result);
                /**
                 *  - the V flag in the CPSR will be unaffected
                 *  - the C flag will be set to the carry out from the barrel shifter (or preserved when the shift operation is LSL #0)
                 *  - the Z flag will be set if and only if the result is all zeros
                 *  - and the N flag will be set to the logical value of bit 31 of the result.
                 */
                // C
                // @todo
                // Z
                if (result == 0) {
                    cpu.armRegs[16] = cpu.armRegs[16] | CPSR_Z;
                } else {
                    cpu.armRegs[16] = cpu.armRegs[16] & ~CPSR_Z;
                }
                // N
                if ((result & 0x80000000) != 0) {
                    cpu.armRegs[16] = cpu.armRegs[16] | CPSR_N;
                } else {
                    cpu.armRegs[16] = cpu.armRegs[16] & ~CPSR_N;
                }
            }
        },
        multiply        : function(instruction, cpu) {
        
        },
        singleDataTransfer : function(instruction, cpu) {
            console.log('Single data transfer');
            
            var immediate = instruction         & 0x2000000;
            var prePostIndexing = instruction   & 0x1000000;
            var upDown = instruction            & 0x0800000;
            var byteWord = instruction          & 0x0400000;
            var writeBack = instruction         & 0x0200000;
            var loadStore = instruction         & 0x0100000;
            
            var rn = (instruction>>16) & 0xF;   // base reg
            var rd = (instruction>>12) & 0xF;   // source/dest reg
            var offset = instruction   & 0xFFF;
            
            // figure out offset if not immediate
            // (immediate == offset value is a 12 bit unsigned integer)
            if (immediate == 0) {
                
                // @todo this is broken, probably -- we should be shifting the register value
                
                // ofset value is shifted register (rm)
                var rm = offset & 0xF;
                var shiftType = rd & 0x60;
                var shiftAmount = rd >> 7 & 0x1F;
                switch (shiftType) {
                    case 0x0:   // logical shift left
                        rm = rm << shiftAmount;
                        break;
                    case 0x1:   // logical shift right
                        rm = rm >>> shiftAmount;
                        break;
                    case 0x2:   // arithmatic shift right
                        rm = rm >> shiftAmount;
                        break;
                    case 0x3:   // rotate right
                        rm = rm | (rm << 0xF);
                        rm = rm >> shiftAmount;
                        rm = rm & 0xF;
                        break;
                }
                offset = rm;
            }
            
            var addr = cpu.armRegs[rn]; // base reg
            
            // pre-index? (add offset before)
            if (prePostIndexing > 0) {
                if (upDown == 0) {
                    addr -= offset;
                    console.log('Pre-index - ' + offset);
                } else {
                    addr += offset;
                    console.log('Pre-index + ' + offset);
                }
            }
            
            if (loadStore == 0) {
                
                // @todo fix up the memory interface so we're not going direct'
                
                // store
                if (byteWord == 0) {
                    // word
                    cpu.mmu.write32(addr, cpu.armRegs[rd]);
                    console.log('Store word ' + addr + ' (' + cpu.armRegs[rd] + ') <- reg#' + rd);
                } else {
                    // byte
                    cpu.mmu.write8(addr, cpu.armRegs[rd]);
                    console.log('Store byte ' + addr + ' (' + cpu.armRegs[rd] + ') <- reg#' + rd);
                }
            } else {
                // load
                if (byteWord == 0) {
                    // word
                    cpu.armRegs[rd] = cpu.mmu.read32(addr);
                    console.log('Read word ' + addr + ' (' + cpu.armRegs[rd] + ') -> reg#' + rd);
                } else {
                    // byte
                    cpu.armRegs[rd] = cpu.mmu.read8(addr);
                    console.log('Read byte ' + addr + ' (' + cpu.armRegs[rd] + ') -> reg#' + rd);
                }
            }
            
            // post-index? (add offset after)
            if (prePostIndexing == 0) {
                if (upDown == 0) {
                    addr -= offset;
                } else {
                    addr += offset;
                }
            }
            
            // write back?
            if (writeBack > 0) {
                cpu.armRegs[rn] = addr;
            }
        },
        
        /* http://www.coranac.com/tonc/text/asm.htm#ssec-arm-mem */
        strt    : function(instruction, cpu) {
            var rn = (instruction>>16)&0xF;
            var rd = (instruction>>12)&0xF;
            var addr = rn == 15 ? arm610.cpu.armRegs[15] & R15_MASK : arm610.cpu.armRegs[rn];

            // @todo temp switch to user permissions
            // templ = memmode;
            // memmode = 0;
            writememl(addr & ~3, arm610.cpu.armRegs[rd]);
            // memmode = templ;

            /* Check for Abort */
            /*
            if (armirq & 0x40)
                    break;

            /* Writeback */
            /*
            if (opcode & 0x2000000) {
                    addr2 = shift_ldrstr(opcode);
            } else {
                    addr2 = opcode & 0xfff;
            }
            if (!(opcode & 0x800000)) {
                    addr2 = -addr2;
            }
            addr += addr2;
            armregs[RN] = addr;
            break;
            */
        
        }
    }
    
    function decodeInstruction(instruction) {
        console.log("Decoding... " + (instruction >> 24 & 0xF));
        switch (instruction >> 24 & 0xF) {
            /* 0000 (data operation OR multiply) */
            case 0x0:
                if (instruction & 0xF0 == 0x90) {
                    return instructionSet.multiply;
                }
                return instructionSet.dataOperation;
            /* 0001 (data processing OR single data swap) */
            case 0x1:
                if (instruction >> 4 & 0xFF == 0x09) {
                    return instructionSet.notImplemented;
                }
            /* 0010 or 0011 (data processing) */
            case 0x2:
            case 0x3:
                return instructionSet.dataOperation;
            /* 0011 (
            /* 01xx (single data transfer) */
            case 0x4:
            case 0x5:
            case 0x6:
            case 0x7:
                return instructionSet.singleDataTransfer;
            /* 1010 (branch) */
            case 0xA:
                return instructionSet.branch;
            /* 1011 (branch link) */
            case 0xB:
                return instructionSet.branchLink;
            default:
                return instructionSet.notImplemented;
        }
    }
    
    function checkCondition(instruction, cpu) {
        console.log("Evaluation condition... " + (instruction >> 28 & 0xF));
        // PSR: V = bit 28, C = 29, Z = 30, N = 31
        var psr = cpu.armRegs[16];
        switch ((instruction >> 28) & 0xF) {
            case 0x0: // EQ - Z set (equal)
                return (psr & CPSR_Z) != 0;
            case 0x1: // NE - Z clear (not equal)
                return (psr & CPSR_Z) == 0;
            case 0x2: // CS - C set (unsigned higher or same)
                return (psr & CPSR_C) != 0;
            case 0x3: // CC - C clear (unsigned lower)
                return (psr & CPSR_C) == 0;
            case 0x4: // MI - N set (negative)
                return (psr & CPSR_N) != 0;
            case 0x5: // PL - N clear (positive or zero)
                return (psr & CPSR_N) == 0;
            case 0x6: // VS - V set (overflow)
                return (psr & CPSR_V) != 0;
            case 0x7: // VC - V clear (no overflow)
                return (psr & CPSR_V) == 0;
            case 0x8: // HI - C set and Z clear (unsigned higher)
                return (psr & CPSR_C) != 0 && (psr & CPSR_Z) == 0;
            case 0x9: // LS - C clear or Z set (unsigned lower or same)
                return (psr & CPSR_C) == 0 || (psr & CPSR_Z) != 0;
            case 0xA: // GE - N set and V set, or N clear and V clear (greater or equal)
                return ((psr & CPSR_N) != 0 && (psr & CPSR_V) != 0)
                    || ((psr & CPSR_N) == 0 && (psr & CPSR_V) == 0);
            case 0xB: // LT - N set and V clear, or N clear and V set (less than)
                return ((psr & CPSR_N) != 0 && (psr & CPSR_V) == 0)
                    || ((psr & CPSR_N) == 0 && (psr & CPSR_V) != 0);
            case 0xC: // GT - Z clear, and either N set and V set, or N clear and V clear (greater than)
                return (psr & CPSR_Z) == 0 && (
                           ((psr & CPSR_N) != 0 && (psr & CPSR_V) != 0)
                        || ((psr & CPSR_N) == 0 && (psr & CPSR_V) == 0)
                    );
            case 0xD: // LE - Z set, or N set and V clear, or N clear and V set (less than or equal)
                return (psr & CPSR_Z) != 0
                    || ((psr & CPSR_N) != 0 && (psr & CPSR_V) == 0)
                    || ((psr & CPSR_N) == 0 && (psr & CPSR_V) != 0);
            case 0xE: // AL - always 1111
                return true;
            case 0xF: // NV - never (not defined for ARM610)
                return false;
        }
    }
    
    // ---
    
    this.cpu        = new Cpu();

    function Cpu() {
        this.cycles      = 0;
        this.mmu         = new Mmu();
        
        this.mode        = null;
        /* armRegs
         * R0 -> R15 + CPSR + SPSR (the visible registers)
         */
        this.armRegs     = new Uint32Array(18);
        /* bankedRegs
         *  R8_fiq -> R14_fiq       0,1,2,3,4,5,6
         *  SPSR_fiq                7
         *  R13_svc -> R14_svc      8,9
         *  SPSR_svc                10
         *  R13_abt -> R14_abt      11,12
         *  SPSR_abt                13
         *  R13_irq -> R14_irq      14,15
         *  SPSR_irq                16
         *  R13_und -> R14_und      17,18
         *  SPSR_und                19
         */
        this.bankedRegs  = new Uint32Array(20);
        /* swapRegs = R8 to R14 which is the largest intersection of all registers that could change */
        this.swapRegs    = new Uint32Array(17);
        /* saved registered */
        this.savedRegs   = new Uint32Array(17);

        /* pipeline */
        this.fetched     = null;
        this.fetchedAddr = null;
        this.decoded     = null;
        this.decodedAddr = null;
        this.lastExcAddr = null;
    }
    
    Cpu.prototype.updateMode = function(newMode) {
        console.log("Change mode to " + newMode);
        switch (this.mode)
        {
            case MODE_USR:
                for (c=8; c<15; c++) this.savedRegs[c] = this.armRegs[c];
                break;
            case MODE_FIQ:
                for (c=8; c<15; c++) this.bankedRegs[c-8] = this.armRegs[c];
                break;
            case MODE_SVC:
                for (c=8; c<13; c++) this.savedRegs[c] = this.armRegs[c];
                this.bankedRegs[8] = this.armRegs[13];
                this.bankedRegs[9] = this.armRegs[14];
                break;
            case MODE_ABT:
                for (c=8; c<13; c++) this.savedRegs[c] = this.armRegs[c];
                this.bankedRegs[11] = this.armRegs[13];
                this.bankedRegs[12] = this.armRegs[14];
                break;
            case MODE_IRQ:
                for (c=8; c<13; c++) this.savedRegs[c] = this.armRegs[c];
                this.bankedRegs[14] = this.armRegs[13];
                this.bankedRegs[15] = this.armRegs[14];
                break;
            case MODE_UND:
                for (c=8; c<13; c++) this.savedRegs[c] = this.armRegs[c];
                this.bankedRegs[17] = this.armRegs[13];
                this.bankedRegs[18] = this.armRegs[14];
                break;
        }
        switch (newMode)
        {
            case MODE_USR:
                for (c=8; c<15; c++) this.armRegs[c] = this.savedRegs[c];
                break;
            case MODE_FIQ:
                for (c=8; c<15; c++) this.armRegs[c] = this.bankedRegs[c-8];
                break;
            case MODE_SVC:
                for (c=8; c<13; c++) this.armRegs[c] = this.savedRegs[c];
                this.armRegs[13] = this.bankedRegs[8];
                this.armRegs[14] = this.bankedRegs[9];
                break;
            case MODE_ABT:
                for (c=8; c<13; c++) this.armRegs[c] = this.savedRegs[c];
                this.armRegs[13] = this.bankedRegs[11];
                this.armRegs[14] = this.bankedRegs[12];
                break;
            case MODE_IRQ:
                for (c=8; c<13; c++) this.armRegs[c] = this.savedRegs[c];
                this.armRegs[13] = this.bankedRegs[14];
                this.armRegs[14] = this.bankedRegs[15];
                break;
            case MODE_UND:
                for (c=8; c<13; c++) this.armRegs[c] = this.savedRegs[c];
                this.armRegs[13] = this.bankedRegs[17];
                this.armRegs[14] = this.bankedRegs[18];
                break;
        }
        this.mode = newMode;
    }

    Cpu.prototype.reset = function() {
        this.mode = MODE_SVC;
        this.cycles = 0;
    }
    
    Cpu.prototype.run = function(cycles) {
        var toExecute;

        for (c=0; c<cycles; c++) {
            this.cycles++;

            // pipeline
            toExecute = this.decoded;
            this.lastExcAddr = this.decodedAddr;
            this.decoded = this.fetched;
            this.decodedAddr = this.fetchedAddr;
            this.fetched = this.mmu.fetchInstruction(this.armRegs[15]);
            this.fetchedAddr = this.armRegs[15];
            
            // increment addr
            this.armRegs[15] += 4;
            
            if (toExecute == null) {
                // pipeline not full
                continue;
            }
            
            // check condition & execute
            if (checkCondition(toExecute, this)) {
                var func = decodeInstruction(toExecute);
                func(toExecute, this);
            } else {
                console.log("Skipping instruction (condition not met)");
            }
        }
    }
    
    Cpu.prototype.getMode = function() {
        switch (this.mode) {
            case MODE_USR: return 'USR';
            case MODE_FIQ: return 'FIQ';
            case MODE_IRQ: return 'IRQ';
            case MODE_SVC: return 'SVC';
            case MODE_ABT: return 'ABT';
            case MODE_UND: return 'UND';
        }
        return 'invalid';
    }
    
    
    // ---
    
    Arm610.prototype.init = function() {
        this.cpu.reset();
        this.cpu.updateMode(MODE_USR);
        /*
        var prog = [
            0x2a00a0e3,
            0x0ef0a0e1
            ];
        */
        /* Count v1 with FP */
        /*
        var prog = [
            0x04b02de5,
            0x00b08de2,
            0x08d04de2,
            0x0030a0e3,
            0x08300be5,
            0x060000ea,
            0x04201be5,
            0x08301be5,
            0x033082e0,
            0x04300be5,
            0x08301be5,
            0x013083e2,
            0x08300be5,
            0x08301be5,
            0x630053e3,
            0xf5ffffda,
            0x04301be5,
            0x0300a0e1,
            0x00d08be2,
            0x0008bde8,
            0x0ef0a0e1
            ];
            */
        /* count V2 without FP */
        var prog = [
            0x08d04de2,
            0x0030a0e3,
            0x00308de5,
            0x060000ea,
            0x04209de5,
            0x00309de5,
            0x033082e0,
            0x04308de5,
            0x00309de5,
            0x013083e2,
            0x00308de5,
            0x00309de5,
            0x630053e3,
            0xf5ffffda,
            0x04309de5,
            0x0300a0e1,
            0x08d08de2,
            0x0ef0a0e1
            ];
        /* handcrafted cruft */
        /*
        var prog = [
            0x0000a0e3,
            0x0010a0e3,
            0x0130a0e3,
            0x031081e0,
            0x010080e0,
            0x630051e3,
            0xfaffffda
        ];
        */
         
        this.cpu.mmu.load(prog);
        
        // define a stack pointer
        this.cpu.armRegs[13] = 0x00000240;
    }
    
    Arm610.prototype.inspect = function(addr) {
        return this.cpu.mmu.inspect(addr);
    }
    
    Arm610.prototype.step = function() {
        return this.cpu.run(1);
    }
}



